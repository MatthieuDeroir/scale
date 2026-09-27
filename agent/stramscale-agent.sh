#!/usr/bin/env bash
# Agent Stramscale, installé dans l'image dorée des NUC et Raspberry Pi.
#
#   stramscale-agent enroll   premier démarrage : nom unique, enrôlement, VPN, inventaire
#   stramscale-agent adopt T  machine raccordée par clé : enregistre le jeton T, envoie l'inventaire
#   stramscale-agent report   envoie l'inventaire (matériel, OS, paquets)
#   stramscale-agent poll     exécute la mise à jour demandée depuis Stramscale, s'il y en a une
#
# L'agent tire ses ordres : il n'ouvre aucun port et n'accepte que deux actions
# (un paquet précis, ou les paquets de la version installée). Jamais de
# commande libre, jamais de changement de version majeure de l'OS.
set -euo pipefail

CONF="${STRAMSCALE_CONF:-/etc/stramscale/agent.conf}"
STATE="${STRAMSCALE_STATE:-/var/lib/stramscale}"
# shellcheck source=/dev/null
[ -f "$CONF" ] && . "$CONF"
: "${STRAMSCALE_URL:?STRAMSCALE_URL manquant dans $CONF}"
TOKEN_FILE="$STATE/agent-token"
PACKAGE_NAME='^[a-z0-9][a-z0-9+.-]{0,127}$'
APT_OPTS=(-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

mkdir -p "$STATE" && chmod 700 "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || { echo "Agent déjà en cours d'exécution."; exit 0; }

log() { echo "stramscale-agent: $*" >&2; }
token() { cat "$TOKEN_FILE"; }
api() { # méthode chemin [corps JSON sur l'entrée standard]
  curl -sS --fail-with-body --max-time 60 -X "$1" -H "Authorization: Bearer $(token)" \
    -H 'Content-Type: application/json' "${@:3}" "$STRAMSCALE_URL$2"
}

serial() {
  local value=""
  for file in /sys/class/dmi/id/product_serial /proc/device-tree/serial-number; do
    [ -r "$file" ] && value=$(tr -d '\0' <"$file" | tr -d '[:space:]') && [ -n "$value" ] && break
  done
  [ -z "$value" ] && [ -r /proc/cpuinfo ] && value=$(awk -F': ' '/^Serial/ {print $2}' /proc/cpuinfo)
  echo "${value:-inconnu}"
}

model() {
  for file in /sys/class/dmi/id/product_name /proc/device-tree/model; do
    [ -r "$file" ] && { tr -d '\0' <"$file"; return; }
  done
  echo "inconnu"
}

# Nom unique tiré du n° de série : des clones de la même image portent sinon
# tous le même nom d'hôte et deviennent indiscernables dans « À assigner ».
unique_hostname() {
  local slug
  slug=$(serial | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9' | tail -c 12)
  echo "${HOSTNAME_PREFIX:-stra}-${slug:-$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
}

enroll() {
  if [ -s "$TOKEN_FILE" ]; then log "déjà enrôlée"; return 0; fi
  : "${PROVISIONING_SECRET:?PROVISIONING_SECRET manquant dans $CONF}"
  local name device_id response
  name=$(unique_hostname)
  [ "${SET_HOSTNAME:-1}" = 1 ] && command -v hostnamectl >/dev/null && hostnamectl set-hostname "$name"
  device_id=$(cat /proc/sys/kernel/random/uuid)

  local payload
  payload=$(python3 -c 'import json,sys;print(json.dumps(dict(zip(["deviceId","serial","model","hostname"], sys.argv[1:]))))' \
    "$device_id" "$(serial)" "$(model)" "$name")
  response=$(curl -sS --fail-with-body --max-time 60 -H "Authorization: Bearer $PROVISIONING_SECRET" \
    -H 'Content-Type: application/json' --data-binary "$payload" "$STRAMSCALE_URL/api/provisioning/enroll")

  local auth_key login_server
  auth_key=$(python3 -c 'import json,sys;print(json.load(sys.stdin)["authKey"])' <<<"$response")
  login_server=$(python3 -c 'import json,sys;print(json.load(sys.stdin)["loginServer"])' <<<"$response")
  (umask 077; python3 -c 'import json,sys;print(json.load(sys.stdin)["agentToken"])' <<<"$response" >"$TOKEN_FILE")

  "${TAILSCALE_BIN:-tailscale}" up --login-server="$login_server" --authkey="$auth_key" --hostname="$name"
  log "enrôlée sous le nom $name"
  report
}

adopt() {
  local given="${1:-}"
  [ ${#given} -ge 32 ] || { log "jeton manquant ou invalide"; exit 1; }
  (umask 077; printf '%s\n' "$given" >"$TOKEN_FILE")
  log "jeton enregistré"
  report
}

report() {
  [ "${APT_REFRESH:-1}" = 1 ] && apt-get update -qq >/dev/null 2>&1 || true
  {
    dpkg-query -W -f='P\t${Package}\t${Version}\n' 2>/dev/null || true
    apt list --upgradable 2>/dev/null | awk -F'[/ ]' 'NR>1 && NF>=2 {
      current=$0; sub(/.*upgradable from: /, "", current); sub(/\]$/, "", current);
      printf "U\t%s\t%s\t%s\n", $1, current, $3 }' || true
  } | python3 -c '
import json, os, platform, re, shutil, sys
name = re.compile(r"^[a-z0-9][a-z0-9+.-]{0,127}$")
packages, upgradable = [], []
for line in sys.stdin:
    parts = line.rstrip("\n").split("\t")
    if parts[0] == "P" and len(parts) == 3 and name.match(parts[1]):
        packages.append({"name": parts[1], "version": parts[2][:128]})
    elif parts[0] == "U" and len(parts) == 4 and name.match(parts[1]):
        upgradable.append({"name": parts[1], "current": parts[2][:128], "candidate": parts[3][:128]})
osr = {}
try:
    for row in open("/etc/os-release"):
        key, _, value = row.strip().partition("=")
        osr[key] = value.strip("\"")
except OSError:
    pass
cpu = ""
try:
    for row in open("/proc/cpuinfo"):
        if row.lower().startswith(("model name", "hardware")):
            cpu = row.split(":", 1)[1].strip(); break
except OSError:
    pass
mem = 0
try:
    mem = int(next(r for r in open("/proc/meminfo") if r.startswith("MemTotal")).split()[1]) // 1024
except (OSError, StopIteration):
    pass
disk = shutil.disk_usage("/")
uptime = int(float(open("/proc/uptime").read().split()[0]))
print(json.dumps({
    "hostname": platform.node()[:128],
    "osName": osr.get("NAME", "")[:128],
    "osVersion": osr.get("VERSION", osr.get("VERSION_ID", ""))[:128],
    "kernel": platform.release()[:128],
    "arch": platform.machine()[:32],
    "cpu": cpu[:200],
    "cores": os.cpu_count() or 0,
    "memoryMb": mem,
    "diskTotalGb": disk.total // 1024**3,
    "diskFreeGb": disk.free // 1024**3,
    "uptimeSeconds": uptime,
    "packages": packages,
    "upgradable": upgradable,
}))' | api POST /api/agent/inventory --data-binary @- >/dev/null
  log "inventaire envoyé"
}

poll() {
  local job id kind package status output
  job=$(api GET /api/agent/jobs) || { log "Stramscale injoignable"; return 0; }
  [ -z "$job" ] && return 0
  id=$(python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])' <<<"$job")
  kind=$(python3 -c 'import json,sys;print(json.load(sys.stdin)["kind"])' <<<"$job")
  package=$(python3 -c 'import json,sys;print(json.load(sys.stdin).get("package") or "")' <<<"$job")

  export DEBIAN_FRONTEND=noninteractive
  set +e
  case "$kind" in
    upgrade-package)
      # Revalidé ici : l'agent ne fait pas confiance aveuglément au serveur.
      if [[ "$package" =~ $PACKAGE_NAME ]]; then
        output=$(apt-get install --only-upgrade "${APT_OPTS[@]}" -- "$package" 2>&1)
      else
        output="Nom de paquet refusé par l'agent : $package"; false
      fi ;;
    upgrade-system)
      # `upgrade`, pas `dist-upgrade` : aucun paquet supprimé, pas de changement de version de l'OS.
      output=$( { apt-get update -q && apt-get upgrade "${APT_OPTS[@]}"; } 2>&1) ;;
    *) output="Action inconnue, refusée par l'agent : $kind"; false ;;
  esac
  [ $? -eq 0 ] && status=done || status=failed
  set -e

  python3 -c 'import json,sys;print(json.dumps({"status": sys.argv[1], "output": sys.stdin.read()[-20000:]}))' \
    "$status" <<<"$output" | api POST "/api/agent/jobs/$id" --data-binary @- >/dev/null
  log "ordre #$id ($kind${package:+ $package}) : $status"
  report
}

case "${1:-}" in
  enroll) enroll ;;
  adopt) adopt "${2:-}" ;;
  report) report ;;
  poll) poll ;;
  *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

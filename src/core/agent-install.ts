import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AGENT_DIR = join(process.cwd(), 'agent');
const UNITS = [
  'stramscale-agent-poll.service',
  'stramscale-agent-poll.timer',
  'stramscale-agent-report.service',
  'stramscale-agent-report.timer',
];

/** Adresse de Stramscale vue par les machines (≠ celle du navigateur en dev). */
export function publicStramscaleUrl(request: Request): string {
  return (process.env.STRAMSCALE_PUBLIC_URL || new URL(request.url).origin).replace(/\/$/, '');
}

export function agentScript(): string {
  return readFileSync(join(AGENT_DIR, 'stramscale-agent.sh'), 'utf8');
}

/**
 * Installateur pour une machine raccordée par clé : Tailscale si besoin,
 * raccordement au VPN, puis agent + minuteries, et premier inventaire. Aucun
 * secret dedans : clé et jeton arrivent en arguments, une fois, depuis
 * l'interface.
 */
export function installerScript(url: string): string {
  const units = UNITS.map(
    (name) =>
      `cat >/etc/systemd/system/${name} <<'UNIT'\n${readFileSync(join(AGENT_DIR, 'systemd', name), 'utf8').trim()}\nUNIT`
  ).join('\n');

  return `#!/bin/sh
# Installateur de l'agent Stramscale (machine Stramatel raccordée par clé).
# Usage : curl -fsSL ${url}/api/agent/install | sudo sh -s -- --token=… [--authkey=… --login-server=… --hostname=…]
set -eu
URL='${url}'
TOKEN=''; AUTHKEY=''; LOGIN=''; NAME=''
for arg in "$@"; do
  case "$arg" in
    --token=*) TOKEN="\${arg#*=}" ;;
    --authkey=*) AUTHKEY="\${arg#*=}" ;;
    --login-server=*) LOGIN="\${arg#*=}" ;;
    --hostname=*) NAME="\${arg#*=}" ;;
  esac
done
[ -n "$TOKEN" ] || { echo "Argument --token manquant." >&2; exit 1; }
[ "$(id -u)" = 0 ] || { echo "À lancer en root (sudo)." >&2; exit 1; }

if [ -n "$AUTHKEY" ]; then
  command -v tailscale >/dev/null 2>&1 || curl -fsSL https://tailscale.com/install.sh | sh
  if [ -n "$NAME" ]; then
    tailscale up --login-server="$LOGIN" --authkey="$AUTHKEY" --hostname="$NAME"
  else
    tailscale up --login-server="$LOGIN" --authkey="$AUTHKEY"
  fi
fi

command -v python3 >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq python3 >/dev/null; }
curl -fsSL "$URL/api/agent/script" -o /usr/local/bin/stramscale-agent
chmod 755 /usr/local/bin/stramscale-agent
install -d -m 700 /etc/stramscale /var/lib/stramscale
printf 'STRAMSCALE_URL=%s\\nSET_HOSTNAME=0\\n' "$URL" >/etc/stramscale/agent.conf
chmod 600 /etc/stramscale/agent.conf

if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
${units}
  systemctl daemon-reload
  systemctl enable --now stramscale-agent-poll.timer stramscale-agent-report.timer
fi

/usr/local/bin/stramscale-agent adopt "$TOKEN"
echo "Agent Stramscale installé : l'inventaire est envoyé, les mises à jour sont vérifiées toutes les 5 minutes."
`;
}

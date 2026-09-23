#!/usr/bin/env bash
# Met à jour une machine en service, en ligne ou depuis une archive.
#   update-docker.sh                       -> tire la dernière image du registre
#   update-docker.sh --file archive.tar.gz -> applique une archive hors ligne
#
# Toute mise à jour est précédée d'une SAUVEGARDE DE LA BASE et suivie d'une
# vérification de santé. En cas d'échec, retour à l'image précédente.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/stramatel}"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

log() { echo "[update] $*"; }
fail() { echo "[update] ERREUR: $*" >&2; exit 1; }

backup_database() {
  mkdir -p "$BACKUP_DIR"
  local stamp; stamp="$(date +%Y%m%d-%H%M%S)"
  if compgen -G "$DATA_DIR/*.db" > /dev/null; then
    tar -czf "$BACKUP_DIR/db-$stamp.tar.gz" -C "$DATA_DIR" .
    log "sauvegarde : $BACKUP_DIR/db-$stamp.tar.gz"
  else
    log "aucune base à sauvegarder"
  fi
  # Rétention : 10 dernières
  ls -1t "$BACKUP_DIR"/db-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --
}

# Identifiant de l'image en service : c'est vers elle qu'on revient.
previous_image() {
  docker compose -f "$APP_DIR/docker-compose.yml" images --quiet app 2>/dev/null | head -1
}

# Nom:tag attendu par la composition, pour pouvoir y ré-étiqueter l'ancienne image.
target_image() {
  docker compose -f "$APP_DIR/docker-compose.yml" config --images 2>/dev/null | head -1
}

verify_signature() {
  local archive="$1"
  [[ -f "$archive.sha256" ]] || fail "empreinte absente : $archive.sha256"
  sha256sum -c "$archive.sha256" || fail "empreinte invalide — archive refusée"
  # TODO projet : vérifier une signature (cosign / minisign) avant application.
  # Une empreinte prouve l'intégrité, pas l'origine.
}

main() {
  cd "$APP_DIR" || fail "$APP_DIR introuvable"
  local rollback_to; rollback_to="$(previous_image)"

  backup_database

  if [[ "${1:-}" == "--file" ]]; then
    local archive="${2:?chemin de archive attendu en second argument}"
    verify_signature "$archive"
    local tmp; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    tar -xzf "$archive" -C "$tmp"
    ( cd "$tmp" && sha256sum -c SHA256SUMS ) || fail "contenu de l'archive altéré"
    docker load -i "$tmp/image.tar"
  else
    docker compose pull
  fi

  docker compose up -d

  log "vérification de santé…"
  for _ in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then
      log "mise à jour appliquée"
      exit 0
    fi
    sleep 2
  done

  log "santé non confirmée — retour arrière"
  local target
  target="$(target_image)"
  if [[ -n "$rollback_to" && -n "$target" ]]; then
    docker tag "$rollback_to" "$target"
    docker compose up -d
    log "image précédente restaurée ($rollback_to)"
  else
    log "ATTENTION : aucune image précédente identifiée, pas de retour arrière automatique"
  fi
  fail "mise à jour annulée — la base est sauvegardée dans $BACKUP_DIR"
}

main "$@"

#!/usr/bin/env bash
# Installation sur une machine cible neuve (Raspberry Pi ou NUC).
# Idempotent : relançable sans casser une installation existante.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/stramatel}"
SERVICE_USER="${SERVICE_USER:-stramatel}"

log() { echo "[install] $*"; }
fail() { echo "[install] ERREUR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "à lancer en root (sudo)"

detect_serial() {
  if [[ -e /dev/ttyAMA0 ]]; then echo /dev/ttyAMA0
  elif [[ -e /dev/ttyUSB0 ]]; then echo /dev/ttyUSB0
  else echo ""; fi
}

log "création de l'utilisateur de service"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"

# Accès au port série sans privilèges : le service ne tourne pas en root.
usermod -aG dialout "$SERVICE_USER"

mkdir -p "$APP_DIR"/{data,backups}
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
chmod 750 "$APP_DIR" "$APP_DIR/data"

SERIAL="$(detect_serial)"
if [[ -n "$SERIAL" ]]; then
  log "port série détecté : $SERIAL"
else
  log "aucun port série détecté — à renseigner dans .env (SERIAL_PATH)"
fi

if [[ ! -f "$APP_DIR/.env" ]]; then
  log "génération de la configuration"
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
  cat > "$APP_DIR/.env" <<ENV
JWT_SECRET=$SECRET
DATABASE_URL="file:../data/app.db"
PORT=3000
BIND_ADDRESS=0.0.0.0
SERIAL_PATH=$SERIAL
SERIAL_BAUD_RATE=38400
ENV
  chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
else
  log ".env existant conservé"
fi

log "installation de l'unité systemd"
cat > /etc/systemd/system/stramatel.service <<UNIT
[Unit]
Description=Application Stramatel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/docker compose -f $APP_DIR/docker-compose.yml up
ExecStop=/usr/bin/docker compose -f $APP_DIR/docker-compose.yml down
Restart=always
RestartSec=5

# Durcissement — voir security/hardening-check.sh
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable stramatel.service
log "terminé. Démarrer avec : systemctl start stramatel"
log "Le mot de passe administrateur initial s'affiche dans les journaux au premier démarrage."

#!/usr/bin/env bash
# Installe le démarrage automatique du kiosque (lightdm + openbox).
# Séparé de kiosk.sh : on veut pouvoir relancer l'affichage sans reconfigurer
# la machine, et reconfigurer la machine sans écran branché.
set -euo pipefail

KIOSK_USER="${KIOSK_USER:-kiosk}"
APP_DIR="${APP_DIR:-/opt/stramatel}"

[[ $EUID -eq 0 ]] || { echo "à lancer en root (sudo)" >&2; exit 1; }

id -u "$KIOSK_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$KIOSK_USER"

apt-get update
apt-get install -y --no-install-recommends lightdm openbox chromium-browser unclutter x11-xserver-utils

# Ouverture de session automatique
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/50-kiosk.conf <<CONF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-user-timeout=0
user-session=openbox
CONF

mkdir -p "/home/$KIOSK_USER/.config/openbox"
cat > "/home/$KIOSK_USER/.config/openbox/autostart" <<AUTO
bash $APP_DIR/scripts/kiosk.sh &
AUTO
chown -R "$KIOSK_USER:$KIOSK_USER" "/home/$KIOSK_USER/.config"

# Démarrage silencieux : ni logo, ni messages du noyau sur le panneau.
if [[ -f /boot/firmware/cmdline.txt ]]; then
  sed -i 's/$/ quiet loglevel=0 vt.global_cursor_default=0/' /boot/firmware/cmdline.txt
fi
systemctl disable plymouth-start.service 2>/dev/null || true

systemctl set-default graphical.target
echo "[kiosk] configuré. Redémarrer pour appliquer."

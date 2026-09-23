#!/usr/bin/env bash
# Affichage plein écran sur la machine cible.
#
# L'afficheur est un navigateur en mode kiosque pointant sur l'application,
# pas une seconde application. C'est ce qui évite l'architecture à trois têtes
# (serveur + interface + afficheur Electron) et son triple déploiement.
set -euo pipefail

URL="${KIOSK_URL:-http://127.0.0.1:3000/display}"
BROWSER="${KIOSK_BROWSER:-chromium-browser}"

command -v "$BROWSER" >/dev/null 2>&1 || BROWSER=chromium

# Attendre que l'application réponde plutôt que de lancer un navigateur
# sur une page d'erreur, que l'opérateur verra sur le panneau.
for _ in $(seq 1 60); do
  curl -fsS "${KIOSK_HEALTH_URL:-http://127.0.0.1:3000/api/health}" >/dev/null 2>&1 && break
  sleep 2
done

xset s off       # pas d'économiseur d'écran
xset -dpms       # pas de mise en veille de l'écran
xset s noblank
unclutter -idle 0 &   # curseur masqué

exec "$BROWSER" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "$URL"

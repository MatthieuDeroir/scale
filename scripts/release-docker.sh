#!/usr/bin/env bash
# Construit et publie une release. Deux formes :
#   release-docker.sh              -> image poussée sur le registre GitLab
#   release-docker.sh --offline    -> archive autonome pour une machine sans réseau
#
# La forme hors ligne n'est pas un cas particulier : c'est le mode nominal
# pour un équipement posé dans un gymnase ou une usine.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
NAME="$(node -p "require('./package.json').name")"
IMAGE="${CI_REGISTRY_IMAGE:-$NAME}:${CI_COMMIT_TAG:-$VERSION}"
OFFLINE=0
[[ "${1:-}" == "--offline" ]] && OFFLINE=1

echo "[release] $IMAGE"
docker build -t "$IMAGE" .

if [[ $OFFLINE -eq 1 ]]; then
  ARCHIVE="${NAME}-${VERSION}-offline.tar.gz"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  docker save "$IMAGE" -o "$TMP/image.tar"
  cp docker-compose.yml docker-entrypoint.sh "$TMP/"
  cp scripts/install.sh scripts/update-docker.sh "$TMP/"
  [[ -f sbom.json ]] && cp sbom.json "$TMP/"

  # L'empreinte accompagne l'archive : sans elle, rien ne distingue une
  # mise à jour légitime d'une archive substituée sur la clé USB.
  ( cd "$TMP" && sha256sum ./* > SHA256SUMS )

  tar -czf "$ARCHIVE" -C "$TMP" .
  sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
  echo "[release] archive hors ligne : $ARCHIVE"
  echo "[release] TODO signature : signer $ARCHIVE.sha256 avant diffusion (INT-01, UPD-02)"
else
  docker push "$IMAGE"
fi

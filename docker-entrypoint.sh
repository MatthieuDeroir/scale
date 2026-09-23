#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] préparation de la base"
npx prisma db push --skip-generate

# Le seed ne crée un compte que s'il n'en existe aucun : relançable sans risque.
node dist/prisma/seed.js 2>/dev/null || npx tsx prisma/seed.ts || true

echo "[entrypoint] démarrage"
exec node dist/server.mjs

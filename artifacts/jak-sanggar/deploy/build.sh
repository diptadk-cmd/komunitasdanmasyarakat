#!/usr/bin/env bash
# Build Jak Sanggar untuk produksi.
# Output: artifacts/jak-sanggar/dist/public/
#
# Pakai: ./deploy/build.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

echo ">>> Build Jak Sanggar (mode produksi)"
echo "    App:   $APP_DIR"
echo "    Repo:  $REPO_ROOT"

cd "$REPO_ROOT"

# Pasang dependencies (cepat jika sudah ada).
pnpm install --frozen-lockfile

# BASE_PATH=/ karena di VPS aplikasi dipasang di root domain.
# PORT wajib ada karena vite.config.ts validasi env, walau tidak dipakai saat build.
NODE_ENV=production PORT=5000 BASE_PATH=/ \
  pnpm --filter @workspace/jak-sanggar run build

echo ""
echo ">>> Selesai. File siap upload ada di:"
echo "    $APP_DIR/dist/public/"

#!/usr/bin/env bash
# Build + upload Jak Sanggar ke VPS lewat SSH/rsync.
# Pakai: ./deploy/deploy.sh
#
# Memerlukan:
#   - File deploy/.env sudah dibuat dari .env.example
#   - Akses SSH ke VPS sudah lancar (disarankan pakai SSH key, tanpa password)
#   - Skrip setup-vps.sh sudah dijalankan sekali di VPS
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Muat konfigurasi -------------------------------------------------
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "ERROR: $SCRIPT_DIR/.env belum ada."
  echo "       Salin dulu: cp $SCRIPT_DIR/.env.example $SCRIPT_DIR/.env"
  echo "       lalu isi nilainya."
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$SCRIPT_DIR/.env"; set +a

: "${VPS_HOST:?VPS_HOST belum diisi di deploy/.env}"
: "${VPS_USER:?VPS_USER belum diisi di deploy/.env}"
: "${VPS_PORT:=22}"
: "${VPS_PATH:?VPS_PATH belum diisi di deploy/.env}"

# --- Cek tools --------------------------------------------------------
for tool in rsync ssh; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: '$tool' tidak ditemukan. Pasang dulu di komputer Anda."
    exit 1
  fi
done

# --- Build ------------------------------------------------------------
"$SCRIPT_DIR/build.sh"

DIST_DIR="$APP_DIR/dist/public"
if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: Folder build tidak ditemukan: $DIST_DIR"
  exit 1
fi

# --- Upload -----------------------------------------------------------
echo ""
echo ">>> Upload ke ${VPS_USER}@${VPS_HOST}:${VPS_PATH} (port ${VPS_PORT}) ..."

# Pastikan folder tujuan ada di VPS.
ssh -p "$VPS_PORT" "${VPS_USER}@${VPS_HOST}" "mkdir -p '$VPS_PATH'"

# Sinkron file. --delete supaya file lama yang tidak terpakai ikut dibersihkan.
rsync -avz --delete \
  -e "ssh -p $VPS_PORT" \
  --exclude '.DS_Store' \
  "$DIST_DIR"/ \
  "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

# Pastikan permission terbaca Nginx (group www-data).
ssh -p "$VPS_PORT" "${VPS_USER}@${VPS_HOST}" "
  if id -u www-data >/dev/null 2>&1; then
    chown -R ${VPS_USER}:www-data '$VPS_PATH' 2>/dev/null || true
  fi
  find '$VPS_PATH' -type d -exec chmod 755 {} \;
  find '$VPS_PATH' -type f -exec chmod 644 {} \;
"

echo ""
echo ">>> Berhasil! Aplikasi sudah ter-upload."
if [[ -n "${DOMAIN:-}" && "$DOMAIN" != "ganti-dengan-domain-anda" ]]; then
  echo "    Buka: https://${DOMAIN}"
else
  echo "    Buka: http://${VPS_HOST}/"
fi

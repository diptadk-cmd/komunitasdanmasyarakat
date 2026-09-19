#!/usr/bin/env bash
# Setup awal VPS Bizznet (Ubuntu/Debian) untuk Jak Sanggar.
# JALANKAN INI DI VPS SEBAGAI ROOT, hanya sekali.
#
# Cara pakai (dari komputer Anda):
#   1. Sesuaikan deploy/.env (DOMAIN, LETSENCRYPT_EMAIL, VPS_PATH)
#   2. Upload skrip + konfigurasi ke VPS:
#        scp deploy/setup-vps.sh deploy/nginx-jak-sanggar.conf deploy/.env \
#            root@VPS_IP:/root/
#   3. SSH ke VPS, lalu:
#        ssh root@VPS_IP
#        cd /root && bash setup-vps.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Jalankan sebagai root (atau pakai sudo)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Muat konfigurasi -------------------------------------------------
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "ERROR: $SCRIPT_DIR/.env tidak ditemukan. Upload juga file .env-nya."
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$SCRIPT_DIR/.env"; set +a

: "${DOMAIN:?DOMAIN belum diisi di .env}"
: "${VPS_PATH:?VPS_PATH belum diisi di .env}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL belum diisi di .env}"

if [[ "$DOMAIN" == "ganti-dengan-domain-anda" ]]; then
  echo "ERROR: DOMAIN di .env masih placeholder. Isi dulu domain asli."
  exit 1
fi

NGINX_CONF_SRC="$SCRIPT_DIR/nginx-jak-sanggar.conf"
if [[ ! -f "$NGINX_CONF_SRC" ]]; then
  echo "ERROR: $NGINX_CONF_SRC tidak ditemukan. Upload juga file ini."
  exit 1
fi

# --- Update sistem ----------------------------------------------------
echo ">>> [1/6] Update apt + install paket dasar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx curl ufw rsync ca-certificates

# --- Firewall (UFW) ---------------------------------------------------
echo ">>> [2/6] Konfigurasi firewall (UFW)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'   # port 80 + 443
ufw --force enable

# --- Folder web -------------------------------------------------------
echo ">>> [3/6] Siapkan folder web di $VPS_PATH"
mkdir -p "$VPS_PATH"
chown -R root:www-data "$VPS_PATH"
chmod -R 755 "$VPS_PATH"
# Halaman placeholder sebelum file deploy pertama
if [[ ! -f "$VPS_PATH/index.html" ]]; then
  cat >"$VPS_PATH/index.html" <<HTML
<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Jak Sanggar</title></head>
<body style="font-family:system-ui;text-align:center;padding:4rem;">
  <h1>Jak Sanggar — VPS siap.</h1>
  <p>Jalankan <code>./deploy/deploy.sh</code> dari komputer Anda untuk mengunggah aplikasi.</p>
</body></html>
HTML
fi

# --- Nginx site config ------------------------------------------------
echo ">>> [4/6] Pasang konfigurasi Nginx untuk $DOMAIN"
NGINX_DEST="/etc/nginx/sites-available/jak-sanggar"
sed -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__ROOT__|$VPS_PATH|g" \
    "$NGINX_CONF_SRC" > "$NGINX_DEST"

ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/jak-sanggar

# Hapus default site supaya domain root tidak kena
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable nginx
systemctl reload nginx

# --- HTTPS (Let's Encrypt via certbot) --------------------------------
echo ">>> [5/6] Pasang sertifikat HTTPS gratis (Let's Encrypt)"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi

# Cek apakah DOMAIN sudah resolve ke IP server
SERVER_IP="$(curl -fsS https://api.ipify.org || echo "")"
DOMAIN_IP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || echo "")"

if [[ -n "$SERVER_IP" && -n "$DOMAIN_IP" && "$SERVER_IP" != "$DOMAIN_IP" ]]; then
  echo "  PERINGATAN: DNS $DOMAIN ($DOMAIN_IP) belum mengarah ke IP VPS ($SERVER_IP)."
  echo "  Lewati pemasangan HTTPS. Setelah DNS benar, jalankan:"
  echo "    certbot --nginx -d $DOMAIN -m $LETSENCRYPT_EMAIL --agree-tos --no-eff-email --redirect"
else
  certbot --nginx \
    -d "$DOMAIN" \
    -m "$LETSENCRYPT_EMAIL" \
    --agree-tos --no-eff-email --redirect --non-interactive || {
      echo "  certbot gagal. Cek manual: certbot --nginx -d $DOMAIN"
    }
fi

# --- Auto-renew certbot timer biasanya sudah aktif ------------------
systemctl enable --now certbot.timer 2>/dev/null || true

echo ""
echo ">>> [6/6] Selesai!"
echo "    Domain : http://$DOMAIN  (dan https:// jika sertifikat sukses)"
echo "    Web root: $VPS_PATH"
echo ""
echo "Langkah selanjutnya: dari komputer Anda jalankan ./deploy/deploy.sh"

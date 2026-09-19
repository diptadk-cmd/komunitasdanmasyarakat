#!/usr/bin/env bash
# Build Jak Sanggar APK (Trusted Web Activity / TWA) menggunakan Bubblewrap.
#
# Prasyarat (jalankan SEKALI di mesin build, bukan di Replit):
#   - Java JDK 17 (`sudo apt install -y openjdk-17-jdk` di Debian/Ubuntu)
#   - Node.js 20+
#   - Android command-line tools sdkmanager + build-tools 34.0.0 + platform 34
#     Bubblewrap akan otomatis mengunduhnya saat pertama kali jalan.
#   - PWA harus sudah live di domain HTTPS publik (mis. https://jaksanggar.replit.app
#     atau domain custom). Domain itu yang akan ditanam ke APK.
#
# Pemakaian:
#   ./build-apk.sh https://jaksanggar.replit.app
#   (atau domain produksi Abang/Mpok yang lain)
#
# Hasil akhir:
#   apk-build/app-release-signed.apk  → letakkan ke artifacts/jak-sanggar/public/JakSanggar.apk
#
# Catatan keamanan keystore:
#   Bubblewrap akan minta password keystore. SIMPAN password tersebut, jangan
#   hilang. Kalau hilang, update di Play Store TIDAK BISA pakai keystore lama.

set -euo pipefail

PWA_URL="${1:-}"
if [[ -z "$PWA_URL" ]]; then
  echo "Pemakaian: $0 <URL PWA, mis. https://jaksanggar.replit.app>" >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java JDK 17 tidak ditemukan. Pasang dulu:" >&2
  echo "  sudo apt install -y openjdk-17-jdk" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: Node.js / npx tidak ditemukan." >&2
  exit 1
fi

WORKDIR="$(cd "$(dirname "$0")" && pwd)/apk-build"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

MANIFEST_URL="${PWA_URL%/}/manifest.webmanifest"

echo "==> Build APK Jak Sanggar"
echo "    PWA URL      : $PWA_URL"
echo "    Manifest URL : $MANIFEST_URL"
echo "    Workdir      : $WORKDIR"
echo

if [[ ! -f "twa-manifest.json" ]]; then
  echo "==> Inisialisasi proyek TWA (akan unduh Android SDK kalau belum ada)..."
  npx --yes @bubblewrap/cli init --manifest="$MANIFEST_URL"
else
  echo "==> twa-manifest.json sudah ada — lewati init."
fi

echo "==> Build APK release (akan minta password keystore)..."
npx --yes @bubblewrap/cli build

OUT="$WORKDIR/app-release-signed.apk"
if [[ -f "$OUT" ]]; then
  TARGET="$(cd "$(dirname "$0")"/.. && pwd)/public/JakSanggar.apk"
  cp "$OUT" "$TARGET"
  echo
  echo "✅ Selesai. APK disalin ke:"
  echo "   $TARGET"
  echo
  echo "Aplikasi web sekarang akan menampilkan tombol 'Unduh APK' di kartu"
  echo "Pasang Aplikasi. User Android bisa langsung unduh & pasang."
else
  echo "❌ Build gagal — file $OUT tidak terbentuk." >&2
  exit 1
fi

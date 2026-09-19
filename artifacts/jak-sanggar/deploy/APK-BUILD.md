# Cara Membangun APK Jak Sanggar

Aplikasi Jak Sanggar adalah PWA (Progressive Web App). Pengguna Android bisa
"memasang" aplikasi langsung dari browser via tombol **Pasang Aplikasi** di
dasbor — itu jalur paling cepat dan tidak butuh build apa-apa.

Kalau Abang/Mpok mau menyediakan **file `.apk` asli** yang bisa diunduh dari
halaman (mis. agar bisa disebar via WhatsApp/Telegram, atau diunggah ke Google
Play Store), ikuti langkah berikut. Build dilakukan **di mesin lokal atau VPS
Linux** — TIDAK di Replit, karena butuh Android SDK ~3 GB.

## Prasyarat (sekali setup)

1. **Java JDK 17**
   ```bash
   sudo apt update
   sudo apt install -y openjdk-17-jdk
   java -version    # pastikan menampilkan 17.x
   ```
2. **Node.js 20+** (cek `node --version`)
3. **PWA sudah live di domain HTTPS publik** — mis. `https://jaksanggar.replit.app`
   atau domain custom. Bubblewrap akan menanam URL itu ke dalam APK.

## Build

```bash
cd artifacts/jak-sanggar/deploy
./build-apk.sh https://jaksanggar.replit.app
```

Jalannya kira-kira begini:

1. Bubblewrap mengunduh Android command-line tools + build-tools 34 +
   platform-34 (~2,5 GB, sekali saja, di-cache).
2. Bubblewrap membaca `manifest.webmanifest` dari URL Abang/Mpok dan
   menyusun proyek TWA (Trusted Web Activity).
3. Skrip menanyakan password **keystore**:
   - Pilih password yang kuat dan **SIMPAN BAIK-BAIK**.
   - Kalau hilang, update versi APK di Play Store TIDAK BISA pakai keystore
     lama → Abang/Mpok harus daftar ulang aplikasi.
4. Bubblewrap menandatangani APK → `app-release-signed.apk`.
5. Skrip menyalinnya otomatis ke `artifacts/jak-sanggar/public/JakSanggar.apk`.

Setelah file `JakSanggar.apk` ada di folder `public/`, tombol **Unduh APK**
muncul otomatis di kartu Pasang Aplikasi pada dasbor.

## Build berulang (versi baru)

Cukup naikkan `appVersionName` dan `appVersionCode` di
`apk-build/twa-manifest.json` lalu jalankan ulang `./build-apk.sh <URL>`.
Bubblewrap akan ingat keystore yang sudah ada dan tinggal minta password.

## Catatan asset-links (penting untuk pengalaman tanpa address bar)

Supaya APK TWA membuka PWA tanpa menampilkan address bar Chrome, file
`assetlinks.json` harus tersedia di:

```
https://jaksanggar.replit.app/.well-known/assetlinks.json
```

Bubblewrap akan menggenerate isi `assetlinks.json` saat build pertama
(lihat `apk-build/assetlinks.json`). Salin file itu ke folder `public/.well-known/`
lalu deploy ulang web app-nya. Tanpa langkah ini, APK tetap berfungsi tapi
muncul address bar di atas (UX seperti Chrome Custom Tab biasa).

## Submit ke Google Play Store (opsional)

1. Daftar Google Play Developer (sekali bayar $25 USD).
2. Di Google Play Console: buat aplikasi baru → upload `app-release-signed.apk`.
3. Lengkapi metadata (deskripsi, screenshot, kategori, content rating, dll).
4. Tunggu review Google (biasanya 1–7 hari).

## Troubleshooting

- **`Java not found`** → pastikan `java -version` menunjukkan 17.x.
- **`Bubblewrap minta domain digital asset link`** → ini wajar, lanjutkan saja.
  Konfigurasi assetlinks.json menyusul (lihat bagian di atas).
- **Build SDK gagal di langkah pertama** → biasanya jaringan lambat. Jalankan
  ulang `./build-apk.sh <URL>` — Bubblewrap melanjutkan dari cache.
- **APK tidak terpasang di HP** → user perlu mengaktifkan
  `Settings → Apps → Special access → Install unknown apps` untuk browser/file
  manager yang mengunduh APK.

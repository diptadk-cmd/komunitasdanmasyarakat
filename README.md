# JAK SANGGAR NEXT 3.0

## Repository lokal, desain dashboard, dan pengujian

Pembaruan 19 September 2026 menambahkan dashboard responsif, navigasi dengan pencarian, logo JakSanggar, serta pengujian yang dapat diulang. Perubahan ini berada di repository lokal; belum diterapkan ke website produksi.

Di Windows, jalankan `SIAPKAN-PENGUJIAN.bat` satu kali, kemudian `UJI-SEMUA-FITUR.bat`. Pengujian mencakup logika aplikasi/API/dokumen, kecocokan rute dan menu, TypeScript, build produksi, serta skenario browser desktop dan ponsel untuk sembilan peran. Laporan tersimpan di `output/test-reports/index.html`.

- [Panduan menjalankan pengujian dan batas cakupannya](docs/PENGUJIAN.md)
- [Peta fitur dan rute yang diperiksa](docs/PETA-PENGUJIAN.md)
- [Hasil audit dan status verifikasi aktual](docs/HASIL-AUDIT-20260919.md)
- [Logo dan ikon](docs/brand/README.md)
- [Perbaikan preview, unduhan, dan urutan dokumen](docs/PERBAIKAN-DOKUMEN-20260919.md)

Nama launcher “UJI-SEMUA-FITUR” berarti menjalankan seluruh paket tes yang tersedia, bukan jaminan semua alur produksi telah teruji. Integrasi database, perangkat, dan layanan eksternal dijelaskan dalam panduan.

Platform terpadu untuk administrasi, pembinaan, kurasi, keuangan, aset, kerja sama, dan layanan ekosistem sanggar seni. Versi NEXT dikembangkan dari proyek JAK-SANGGAR yang diunggah, dengan struktur sumber asli tetap dipertahankan dan ditingkatkan.

## Yang baru pada versi NEXT

- **Pusat Kendali Cerdas** dengan skor kesiapan kelembagaan 0–100.
- Analisis otomatis untuk profil, keanggotaan, jadwal latihan, administrasi, dan keuangan.
- Rekomendasi prioritas berdasarkan data aktual sanggar.
- Pembuatan **laporan eksekutif HTML siap cetak/PDF**.
- **Pencarian global `Ctrl+K`** untuk berpindah cepat ke seluruh modul.
- Notifikasi operasional nyata untuk anggota, iuran, honor, kurasi, sewa, dan publikasi.
- Mode demo lokal untuk akun contoh yang tetap dapat digunakan saat API atau MariaDB belum tersedia.
- Pemulihan kata sandi berbasis OTP, pembatasan percobaan login/reset, dan pencabutan seluruh sesi setelah reset.
- Perbaikan struktur TypeScript, rute aplikasi, profil sanggar, registrasi, dan modul dokumen.
- Branding baru **JAK SANGGAR NEXT**.

## Modul utama

- Profil dan legalitas sanggar
- Generator administrasi dan arsip dokumen
- Anggota, pelatih, seniman, dan juri
- Jadwal latihan dan presensi
- Kurasi, penilaian, dan sertifikasi
- Kas, iuran, honor, dan pembukuan
- Aset, tempat latihan, serta layanan sewa
- Kerja sama antarsanggar
- Dashboard admin dan konsol kurator
- Pengaturan tampilan, identitas, dan publikasi

## Cara tercepat menjalankan di Windows

Folder utama menyediakan empat launcher sesuai sumber data dan jenis aplikasi:

| File                                       | Fungsi                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `01-DEMO-API-DAN-MARIADB.bat`              | Demo dengan akun contoh yang tersimpan melalui API ke MariaDB  |
| `02-DEMO-LOKAL-TANPA-DATABASE.bat`         | Demo lokal dengan data browser, tanpa API dan MariaDB          |
| `03-APLIKASI-NON-DEMO-API-DAN-MARIADB.bat` | Aplikasi utama tanpa tombol akun demo, memakai API dan MariaDB |
| `04-KURATOR-API-DAN-MARIADB.bat`           | Konsol Kurator yang memakai API dan MariaDB                    |

Kedua versi demo menampilkan tombol akun contoh. Satu klik pada tombol langsung menjalankan proses login ke akun yang dipilih. Demo API tetap melakukan autentikasi server biasa; demo lokal melakukan autentikasi hanya di browser.

### A. Demo API dan MariaDB

Klik dua kali:

```text
01-DEMO-API-DAN-MARIADB.bat
```

Launcher menyinkronkan skema, memastikan akun contoh tersedia di MariaDB, menjalankan API, lalu membuka aplikasi pada `http://localhost:5175/`. Pilih tombol Sanggar, Admin, Pelatih, Seniman, Juri, Pengrajin, atau Penyedia Sewa untuk langsung masuk. Perubahan tersimpan melalui API ke MariaDB. Agar tombol selalu dapat digunakan, kata sandi khusus akun contoh dikembalikan ke nilai demo setiap kali launcher ini dijalankan; akun lain tidak disentuh.

### B. Demo lokal tanpa database

Klik dua kali:

```text
02-DEMO-LOKAL-TANPA-DATABASE.bat
```

Launcher membuka aplikasi dan Konsol Kurator demo dengan penyimpanan browser:

| Layanan demo        | Alamat                          |
| ------------------- | ------------------------------- |
| Aplikasi demo       | `http://localhost:5180/`        |
| Konsol Kurator demo | `http://localhost:5180/konsol/` |

Akun demo:

| Peran         | Username         | Password       |
| ------------- | ---------------- | -------------- |
| Kurator       | `Penguasa jak1`  | `ayamayaman`   |
| Sanggar       | `betawi.merah`   | `sanggar123`   |
| Admin         | `admin1`         | `admin123`     |
| Pelatih       | `pelatih.iwan`   | `pelatih123`   |
| Seniman       | `ayu.tari`       | `seniman123`   |
| Juri          | `juri1`          | `juri123`      |
| Pengrajin     | `pengrajin.demo` | `pengrajin123` |
| Penyedia sewa | `sewa.demo`      | `sewa1234`     |

Mode demo lokal tidak meneruskan permintaan ke API. Data tetap terpisah dari MariaDB. Tombol akun utama tersedia pada aplikasi, sedangkan tombol Kurator Demo tersedia pada Konsol Kurator.

### C. Aplikasi non-demo dengan API dan MariaDB

1. Pasang **Node.js 22 LTS** dan MariaDB.
2. Buat database bernama `jaksanggar`.
3. Salin `.env.example` menjadi `.env`, lalu sesuaikan `MARIADB_URL`.
4. Klik dua kali:

```text
03-APLIKASI-NON-DEMO-API-DAN-MARIADB.bat
```

Layanan yang dibuka adalah aplikasi utama pada `http://localhost:5173/` dan API pada `http://localhost:3000/api/healthz`. Tombol akun demo disembunyikan dan login selalu menggunakan API.

### D. Konsol Kurator dengan API dan MariaDB

Klik dua kali:

```text
04-KURATOR-API-DAN-MARIADB.bat
```

Launcher memastikan API sehat lalu membuka Konsol Kurator pada `http://localhost:5174/konsol/`. Hanya akun berperan Kurator yang diterima. Tombol akun demo tidak ditampilkan pada mode ini.

Launcher API menjalankan sinkronisasi skema sebelum API dimulai. Bila akun MariaDB memakai kata sandi, ubah `MARIADB_URL` pada `.env`.

## Persyaratan

- Windows 10/11 64-bit
- Node.js 22 LTS
- Internet pada instalasi pertama untuk mengunduh dependensi
- MariaDB 10.11+ untuk semua mode selain demo lokal
- Browser modern: Chrome, Edge, atau Firefox

## Perintah pengembang

```bash
corepack enable
corepack pnpm install

# Aplikasi utama
corepack pnpm run dev:app

# Aplikasi demo
corepack pnpm run dev:demo:app

# API
corepack pnpm run dev:api

# Sinkronisasi skema MariaDB
corepack pnpm --filter @workspace/db run sync

# Konsol kurator
corepack pnpm run dev:konsol

# Konsol kurator demo
corepack pnpm run dev:demo:konsol

# Pemeriksaan TypeScript
corepack pnpm run typecheck

# Unit test
corepack pnpm run test

# Build seluruh workspace
corepack pnpm run build

# Test + typecheck + build seperti CI
corepack pnpm run verify
```

## Struktur proyek

```text
artifacts/
  jak-sanggar/   aplikasi utama React + Vite
  konsol/        konsol kurator
  api-server/    REST API Express
lib/
  db/            schema MariaDB/Drizzle
  jaksanggar-core/ autentikasi, store, model, dan alur bisnis
  api-zod/       kontrak validasi API
scripts/         utilitas pengembangan dan konversi dokumen
```

## Catatan data dan keamanan

- Jangan memasukkan file `.env`, kata sandi, database lokal, atau `node_modules` ke repositori publik.
- Ganti seluruh akun demo sebelum produksi.
- Gunakan HTTPS dan `NODE_ENV=production` pada server publik.
- Gunakan akun database khusus dengan hak minimum, bukan akun `root`.
- Atur `WHATSAPP_OTP_WEBHOOK_URL` untuk mengaktifkan OTP reset kata sandi. Webhook menerima JSON berisi `to`, `purpose`, `code`, `expiresInMinutes`, dan `message`.
- `PASSWORD_RESET_DEV_EXPOSE_OTP=true` hanya boleh dipakai di komputer pengembangan; server production selalu menolak menampilkan OTP pada respons.
- Konfigurasi penyimpanan S3/MinIO tersedia melalui variabel `S3_*` pada `.env.example`.
- Petunjuk backend lanjutan tersedia di `artifacts/jak-sanggar/deploy/BACKEND.md`.

## Status validasi rilis

- Unit test, typecheck, dan build dapat dijalankan serentak melalui `corepack pnpm run verify`.
- GitHub Actions menjalankan pemeriksaan yang sama pada setiap push dan pull request.

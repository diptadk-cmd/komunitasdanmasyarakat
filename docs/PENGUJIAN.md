# Menguji JakSanggar di komputer ini

Repository ini berisi aplikasi utama, konsol kurator, API, logika bersama, tes regresi, serta tes browser. Pengujian browser menggunakan data demo lokal yang terpisah dari server publik.

## Jalankan di Windows

1. Pasang LibreOffice untuk konversi dokumen ke PDF. Lokasi standar Windows terdeteksi otomatis; bila berbeda, tetapkan `LIBREOFFICE_PATH` pada `.env` atau lingkungan proses sebelum menjalankan launcher.
2. Jalankan `SIAPKAN-PENGUJIAN.bat` sekali untuk memasang dependensi dan Chromium pengujian. Skrip ini tidak memasang LibreOffice.
3. Jalankan `UJI-SEMUA-FITUR.bat` untuk pemeriksaan unit/API, rute, TypeScript, build produksi, berkas Word/PDF nyata, dan browser desktop/ponsel.
4. Buka `output/test-reports/index.html`. Laporan menampilkan lulus, gagal, atau belum dijalankan. Kegagalan browser menyertakan screenshot dan trace pada laporan Playwright.

Perintah setara:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm run test:all
```

Memerlukan Node.js 22.12 atau lebih baru dalam keluarga 22 dan pnpm 11.17.0 melalui Corepack. `test:all` menjalankan seluruh kelompok walaupun salah satunya gagal, menghasilkan laporan lengkap, lalu mengembalikan kode keluar bukan nol jika ada kegagalan.

Konfigurasi dependensi native saat ini ditujukan untuk **Windows x64** dan **Ubuntu/Linux x64 dengan glibc**. CI memakai Ubuntu x64. macOS, ARM, dan Linux musl belum didukung oleh konfigurasi override paket yang tersimpan; jangan menganggap instalasi pada platform tersebut sudah teruji.

Di Ubuntu, pasang `libreoffice-writer` dan `fonts-liberation` sebelum tes dokumen. Font yang tersedia dapat memengaruhi pemenggalan halaman PDF.

## Perintah terpisah

| Perintah | Pemeriksaan |
|---|---|
| `corepack pnpm test` | Tes logika, dokumen, API, dan regresi workspace; konversi berkas nyata memakai perintah terpisah |
| `corepack pnpm run test:documents` | Seluruh template Word dan satu PDF per kelompok melalui generator lokal |
| `corepack pnpm run test:navigation` | Target menu dan tautan statis terhadap router aktual |
| `corepack pnpm run test:coverage` | Inventaris fitur, rute, dan batas cakupan |
| `corepack pnpm run typecheck` | TypeScript seluruh workspace |
| `corepack pnpm run build:production` | Build API, aplikasi utama `/`, konsol `/konsol/` |
| `corepack pnpm run test:e2e` | Smoke test browser semua peran, desktop dan seluler |
| `corepack pnpm run test:e2e:list` | Daftar skenario browser tanpa menjalankan browser |
| `corepack pnpm run test:quick` | Unit, rute, TypeScript, dan build; konversi berkas nyata dan browser tetap belum dijalankan |
| `corepack pnpm run test:report` | Buka laporan Playwright yang sudah dihasilkan |
| `corepack pnpm run dev:renderer` | Memastikan generator Word/PDF lokal aktif di port 3001 |

## Generator Word/PDF lokal

`MULAI-GENERATOR-DOKUMEN.bat` menjalankan generator sebagai proses latar belakang di `127.0.0.1:3001`. `dev:demo-app` juga memastikan generator lokal siap. `dev:api` dan launcher API Windows melakukan hal yang sama bila API memakai alamat generator bawaan; alamat khusus memakai layanan yang Anda sediakan. Skrip generator memuat `.env` tanpa menimpa nilai lingkungan proses yang sudah ditetapkan. Log tersimpan di `output/renderer.log`; kesiapan native dapat diperiksa pada `http://127.0.0.1:3001/healthz`. Layanan membutuhkan seluruh katalog/template serta LibreOffice agar health check menyatakan siap.

Setelah memperbarui konfigurasi generator, mulai ulang proses API lokal yang sudah berjalan, lalu muat ulang halaman. Launcher menggunakan kembali API yang sehat sehingga konfigurasi proses lama tidak otomatis berganti. Generator latar belakang juga tetap hidup setelah jendela launcher ditutup; perubahan lingkungan renderer berlaku setelah proses renderer dimulai ulang.

Generator langsung, startup demo, dan `test:documents` memakai alamat bawaan `http://127.0.0.1:3001/render`. Jika menggunakan `DOCUMENT_RENDERER_URL` khusus, pastikan layanan tujuan dan proses API dikonfigurasi konsisten; tes dokumen tetap memeriksa renderer lokal bawaan. Middleware demo hanya menerima tujuan renderer loopback dan permintaan template native. Autentikasi API utama tetap berlaku.

`test:documents` menghasilkan `output/test-reports/documents/summary.json` dan sampel PDF per kelompok. Pada audit 19 September 2026, 202 Word dan 14 PDF berhasil dibuat. Hasil tersebut mencakup satu PDF per kelompok, bukan seluruh template dalam format PDF. Rincian penyebab masalah dan bukti pemeriksaan ada pada [Perbaikan dokumen](PERBAIKAN-DOKUMEN-20260919.md).

## Arti cakupan

Inventaris mencakup seluruh rute yang dideklarasikan aplikasi. Smoke test memastikan akses, render halaman, navigasi menu, dan perilaku dasar dashboard. Tes unit mencakup aturan bisnis yang sudah memiliki pengujian. Halaman berhasil dibuka **belum** membuktikan seluruh kombinasi tambah/edit/hapus, izin, unggahan, dan alur transaksi halaman tersebut benar.

Lihat `docs/PETA-PENGUJIAN.md` untuk matriks peran dan jenis pemeriksaan. API dan server eksternal tidak dihubungi oleh smoke test demo untuk membuat transaksi nyata. Jangan mengganti alamat uji dengan domain produksi.

Gunakan konteks browser terisolasi untuk pemeriksaan manual. Data QA yang tersimpan pada origin lama dapat tidak memiliki akun demo yang diperlukan; origin uji baru atau profil browser uji baru menghindari keadaan tersebut. Suite Playwright sudah membuat konteks baru untuk setiap tes. Login Kurator melalui tombol demo dan form manual telah berhasil diperiksa dengan CUA pada origin bersih.

Pada audit 19 September 2026, skenario Playwright lengkap sudah ditulis dan diperiksa daftarnya, tetapi runner browser lengkap belum dijalankan. Pemeriksaan browser yang dilaporkan berasal dari interaksi CUA yang disebutkan secara khusus; jangan menyamakannya dengan kelulusan seluruh suite E2E.

## Integrasi database dan perangkat

Tes `communications.integration.test.ts` bersyarat: tanpa `COMMUNICATIONS_QA_DATABASE_URL`, hasilnya dilaporkan **skipped**, bukan lulus. Tes ini dibatasi oleh kode ke database `communications_qa` pada `127.0.0.1:3308`, dan memakai data sintetis. Siapkan database uji dengan skema pada `lib/db` sebelum mengaktifkannya. Jangan gunakan kredensial atau database produksi.

Email reset, penyimpanan unggahan server, kamera, mikrofon/panggilan, GPS, instalasi PWA, dan portal pihak ketiga memerlukan pengujian integrasi/perangkat. Gunakan akun uji pada staging, dua perangkat untuk panggilan, serta izin perangkat yang sesuai. Hasil pemeriksaan ini perlu dicatat pada matriks; tes lokal tidak mengklaim menggantikannya.

## Referensi

Konfigurasi server pengujian mengikuti [dokumentasi resmi Playwright](https://playwright.dev/docs/test-webserver). Artefak runtime, sesi browser, `.env`, database, dan output build dikecualikan dari Git melalui `.gitignore`.


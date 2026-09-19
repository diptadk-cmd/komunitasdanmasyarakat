# Menguji JakSanggar di komputer ini

Repository ini berisi aplikasi utama, konsol kurator, API, logika bersama, tes regresi, serta tes browser. Pengujian browser menggunakan data demo lokal yang terpisah dari server publik.

## Jalankan di Windows

1. Jalankan `SIAPKAN-PENGUJIAN.bat` sekali untuk memasang dependensi dan Chromium pengujian.
2. Jalankan `UJI-SEMUA-FITUR.bat` untuk pemeriksaan unit/API, rute, TypeScript, build produksi, dan browser desktop/ponsel.
3. Buka `output/test-reports/index.html`. Laporan menampilkan lulus, gagal, atau belum dijalankan. Kegagalan browser menyertakan screenshot dan trace pada laporan Playwright.

Perintah setara:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm run test:all
```

Memerlukan Node.js 22.12 atau lebih baru dalam keluarga 22 dan pnpm 11.17.0 melalui Corepack. `test:all` menjalankan seluruh kelompok walaupun salah satunya gagal, menghasilkan laporan lengkap, lalu mengembalikan kode keluar bukan nol jika ada kegagalan.

Konfigurasi dependensi native saat ini ditujukan untuk **Windows x64** dan **Ubuntu/Linux x64 dengan glibc**. CI memakai Ubuntu x64. macOS, ARM, dan Linux musl belum didukung oleh konfigurasi override paket yang tersimpan; jangan menganggap instalasi pada platform tersebut sudah teruji.

## Perintah terpisah

| Perintah | Pemeriksaan |
|---|---|
| `corepack pnpm test` | Semua tes logika, dokumen, API, dan regresi yang tersedia |
| `corepack pnpm run test:navigation` | Target menu dan tautan statis terhadap router aktual |
| `corepack pnpm run test:coverage` | Inventaris fitur, rute, dan batas cakupan |
| `corepack pnpm run typecheck` | TypeScript seluruh workspace |
| `corepack pnpm run build:production` | Build API, aplikasi utama `/`, konsol `/konsol/` |
| `corepack pnpm run test:e2e` | Smoke test browser semua peran, desktop dan seluler |
| `corepack pnpm run test:e2e:list` | Daftar skenario browser tanpa menjalankan browser |
| `corepack pnpm run test:quick` | Semua pemeriksaan kecuali browser; status browser tetap belum dijalankan |
| `corepack pnpm run test:report` | Buka laporan Playwright yang sudah dihasilkan |

## Arti cakupan

Inventaris mencakup seluruh rute yang dideklarasikan aplikasi. Smoke test memastikan akses, render halaman, navigasi menu, dan perilaku dasar dashboard. Tes unit mencakup aturan bisnis yang sudah memiliki pengujian. Halaman berhasil dibuka **belum** membuktikan seluruh kombinasi tambah/edit/hapus, izin, unggahan, dan alur transaksi halaman tersebut benar.

Lihat `docs/PETA-PENGUJIAN.md` untuk matriks peran dan jenis pemeriksaan. API dan server eksternal tidak dihubungi oleh smoke test demo untuk membuat transaksi nyata. Jangan mengganti alamat uji dengan domain produksi.

Gunakan konteks browser terisolasi untuk pemeriksaan manual. Data QA yang tersimpan pada origin lama dapat tidak memiliki akun demo yang diperlukan; origin uji baru atau profil browser uji baru menghindari keadaan tersebut. Suite Playwright sudah membuat konteks baru untuk setiap tes. Login Kurator melalui tombol demo dan form manual telah berhasil diperiksa dengan CUA pada origin bersih.

## Integrasi database dan perangkat

Tes `communications.integration.test.ts` bersyarat: tanpa `COMMUNICATIONS_QA_DATABASE_URL`, hasilnya dilaporkan **skipped**, bukan lulus. Tes ini dibatasi oleh kode ke database `communications_qa` pada `127.0.0.1:3308`, dan memakai data sintetis. Siapkan database uji dengan skema pada `lib/db` sebelum mengaktifkannya. Jangan gunakan kredensial atau database produksi.

Email reset, penyimpanan unggahan server, kamera, mikrofon/panggilan, GPS, instalasi PWA, dan portal pihak ketiga memerlukan pengujian integrasi/perangkat. Gunakan akun uji pada staging, dua perangkat untuk panggilan, serta izin perangkat yang sesuai. Hasil pemeriksaan ini perlu dicatat pada matriks; tes lokal tidak mengklaim menggantikannya.

## Referensi

Konfigurasi server pengujian mengikuti [dokumentasi resmi Playwright](https://playwright.dev/docs/test-webserver). Artefak runtime, sesi browser, `.env`, database, dan output build dikecualikan dari Git melalui `.gitignore`.


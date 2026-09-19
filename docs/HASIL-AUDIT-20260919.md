# Hasil audit dan pembaruan JakSanggar — 19 September 2026

Pembaruan dashboard dan perbaikan tersedia di repository lokal. Pemeriksaan menemukan beberapa tautan yang salah dan kendala data demo lama. Hasil ini belum menjamin seluruh fitur atau transaksi produksi berjalan pada semua kondisi. Tidak ada deployment maupun perubahan data produksi dalam pekerjaan ini.

## Sumber yang diperiksa

Sebelum pembaruan, SHA256 indeks build lokal cocok persis dengan respons HTTPS `www.komunitasdanmasyarakat.com`:

| Aplikasi | SHA256 indeks produksi sebelum perubahan |
|---|---|
| Utama | `293f29e8b3009a4a270fe5f8fd872b139c3478880281d298150200d4d1990454` |
| Konsol | `e13e87f04d228f530d44556664b70dff0314a27d704af680f788b101250db788` |

## Pembaruan dan perbaikan

- Tata letak aplikasi utama dan konsol diperbarui: navigasi yang dapat dicari, kelompok menu, drawer seluler, header, serta keadaan menu aktif dan hasil kosong yang lebih jelas.
- Beranda Sanggar dan Kurator ditata ulang untuk memperjelas ringkasan, tindakan prioritas, dan akses cepat. Logo/ikon JakSanggar baru dibuat memakai skill imagegen dan dipasang pada identitas dashboard.
- Notifikasi pengrajin mengarah ke halaman pesanan produk yang benar; notifikasi konsumen langsung menuju detail pesanan yang tersedia.
- Alias lama Sewa/Konsumen, Kurator, dan Mitra diperbaiki agar URL akar maupun alamat bertingkat mencapai tujuan yang sesuai. Guard autentikasi tetap berlaku.
- Notifikasi konsol kini membuka ringkasan dan tautan tindakan. Grafik kas membedakan bulan lintas tahun dan mempertahankan nilai saldo negatif.
- Injector dashboard lama yang mengubah DOM serta menampilkan status server tanpa memeriksa server dilepas. Cache service worker diberi versi baru.
- Bahasa dan metadata konsol diperbaiki; batas pembesaran browser dihapus. Tombol demo Kurator memakai akun skenario yang tersedia; panel demo kosong disembunyikan.
- Pemuatan modul Tools Dokumen di server Vite diperbaiki menggunakan URL aset absolut berbasis `BASE_URL`. Sebelumnya Vite menambahkan `?import` ke aset publik dan menghasilkan HTTP 500; halaman dokumen sudah dibuka ulang melalui browser tanpa overlay kesalahan.

## Hasil pengujian

| Pemeriksaan | Hasil |
|---|---|
| Tes unit/API/regresi | 273 tes: 272 lulus, 1 integrasi database bersyarat dilewati |
| Tes cakupan navigasi | 11 lulus |
| TypeScript seluruh workspace | Lulus setelah versi package manager diselaraskan ke pnpm 11.17.0 |
| Build produksi API, utama, dan konsol | Lulus |
| Browser lokal melalui CUA | Beranda sembilan peran berhasil dimuat |
| Tampilan ponsel melalui CUA | Dashboard Sanggar dan Kurator muat pada lebar 390 px tanpa luapan horizontal; drawer menutup setelah memilih menu |
| Login Kurator pada origin lokal bersih melalui CUA | Tombol demo dan form username/password manual lulus; notifikasi berhasil serta `kurator-home` terlihat |
| Browser produksi, baca saja | 14 menu konsol dan pemeriksaan halaman publik berhasil dibuka |
| Endpoint publik | Tujuh endpoint kesehatan/konten/direktori mengembalikan HTTP 200 JSON |
| Suite Playwright mandiri | 54 kasus berhasil didaftar dan pemeriksaan TypeScript ketat lulus: 27 definisi × 2 proyek, termasuk 2 kasus drawer desktop yang direncanakan dilewati. Suite belum dieksekusi dalam sesi ini karena pengoperasian browser sesi dibatasi ke CUA |

Data browser QA lama pada port 5181/5182 tidak memiliki akun Kurator yang diperlukan. Pada origin lokal bersih di port 52741, tombol demo dan form login manual berhasil masuk sebagai `kurator.demo02`, menampilkan notifikasi berhasil dan dashboard Kurator. Tidak ada bug form login yang terbukti. Gunakan konteks browser terisolasi atau origin uji baru agar data QA lama tidak memengaruhi hasil; suite Playwright menggunakan konteks baru untuk setiap tes.

## Batas cakupan dan cara mengulang

Membuka halaman dan menu belum menguji seluruh kombinasi tambah/edit/hapus, persetujuan, hak akses lintas akun, unggahan, ekspor, pembayaran, atau sinkronisasi. Email/OTP, MariaDB, panggilan suara/video, kamera, GPS, PWA, dan layanan pihak ketiga memerlukan lingkungan integrasi atau perangkat yang sesuai. Tidak ada CRUD, pengiriman pesan, pembayaran, maupun deployment langsung ke produksi.

Lihat [panduan pengujian](PENGUJIAN.md) dan [peta cakupan](PETA-PENGUJIAN.md). `corepack pnpm run test:all` menjalankan tes repository, termasuk suite browser yang tersedia, dan menulis hasil ke `output/test-reports/`. Tes database yang belum dikonfigurasi tetap dilaporkan sebagai dilewati.

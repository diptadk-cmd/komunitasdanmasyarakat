# Changelog — JAK SANGGAR NEXT 3.0

## Fitur baru

- Menambahkan halaman **Pusat Kendali Cerdas** untuk akun sanggar.
- Menambahkan skor kesiapan kelembagaan berbobot dan rekomendasi prioritas.
- Menambahkan asisten operasional berbasis data lokal tanpa kewajiban API AI eksternal.
- Menambahkan laporan eksekutif HTML siap cetak.
- Menambahkan command palette/pencarian global dengan pintasan `Ctrl+K`.
- Mengganti notifikasi dummy menjadi notifikasi berbasis kondisi data dan peran pengguna.
- Menambahkan launcher demo Windows tanpa kebutuhan MariaDB.
- Menambahkan launcher lengkap Windows yang melakukan bootstrap dependensi dan sinkronisasi skema.
- Memisahkan aplikasi dan Konsol Kurator demo (`5180`/`5181`) dari layanan non-demo (`5173`/`5174`).
- Menambahkan launcher Windows mandiri untuk aplikasi demo, konsol demo, API utama, aplikasi utama, dan konsol utama.

## Perbaikan

- Memperbaiki struktur akhir `App.tsx` yang rusak/duplikat.
- Memperbaiki struktur akhir halaman pemilihan registrasi.
- Memperbaiki import tipe pengguna juri pada formulir registrasi.
- Memperbaiki field wilayah pada draft profil sanggar.
- Memperbaiki import tidak valid pada modul dokumen.
- Membatasi login lokal akun demo hanya pada launcher demo di localhost.
- Mengubah nama produk default menjadi **JAK SANGGAR NEXT**.

## Validasi

- Pemeriksaan TypeScript workspace berhasil.
- Pemeriksaan TypeScript aplikasi utama berhasil.

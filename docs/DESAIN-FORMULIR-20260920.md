# Formulir dan review dokumen

Tujuan: mengisi administrasi sanggar dengan bagian yang kecil dan jelas, kemudian memeriksa hasil cetak dalam ruang tersendiri. Seluruh data, urutan dokumen, penyimpanan, dan ekspor tetap dipakai.

Palet mengikuti dashboard: putih `#FFFFFF`, latar `#F4F7FA`, tinta `#173247`, hijau `#17675B`, garis `#DCE6EB`, dan teks sekunder `#596F7F`. Jenis huruf mengikuti sans serif aplikasi; judul 21–28 px, kelompok 14–15 px, label 13 px. Judul dokumen memakai sentence case, tanpa blok kapital besar.

Susunan awal:

```text
Jenis / kelompok dokumen
Berita Acara Pembentukan Sanggar       [Ganti dokumen]
Isi data                 Review & unduh

Lengkapi isian                       [kemajuan]
Data profil tersedia                   [Isi otomatis]
Cari isian                         Hanya yang kosong
▾ Identitas sanggar                            1 / 2
  Nama sanggar       Jenis / identitas
  [Lanjut ke kelompok berikutnya]
▸ Forum dan kegiatan                           0 / 5
▸ Nomor dan periode                            0 / 4
Logo, stempel, kop surat · opsional                 +

Ringkasan draf                [Simpan isian] [Pratinjau]
```

Review memisahkan PDF dari formulir. Tombol kembali mengembalikan isian yang sama. Pilihan dokumen dibuka hanya saat diperlukan, kelompok isian menggunakan satu panel terbuka, dan unggahan opsional tidak mendominasi awal halaman. Pencarian menampilkan seluruh hasil yang cocok agar panel tertutup tidak menyembunyikan isian yang dicari.

Setiap kelompok menampilkan maksimal enam isian per halaman. Dokumen Data Induk Sanggar dengan 130 isian tetap dimulai dengan enam isian, bukan seluruh formulir. Pencarian dan filter kosong menampilkan hasil lintas bagian; kolom yang sedang diketik tetap ada sampai fokus berpindah. Tombol pergantian halaman memindahkan fokus ke judul bagian agar pengguna keyboard dapat masuk ke isian yang baru.

Pada ponsel, tombol Simpan isian dan Pratinjau tetap terjangkau di atas navigasi bawah. Keterangan draf lengkap muncul pada tahap review. Ringkasan review dan tombol Word/PDF mendahului pratinjau panjang, dengan tautan Buka PDF penuh.

Konsep awal dua sidebar dan semua kartu unggahan ditolak karena mengulang navigasi aplikasi dan menghabiskan ruang kerja. Desain memakai satu bidang formulir dengan pemisah kelompok; warna hanya menandai bagian aktif, tindakan utama, dan status draf. Pada ponsel, isian menjadi satu kolom dan tindakan penting berada di atas navigasi bawah aplikasi.

## Verifikasi lokal, 20 September 2026

- `pnpm test:quick`: 323 tes lulus, satu tes bersyarat database dilewati; 11 tes navigasi lulus; TypeScript seluruh workspace dan build aplikasi utama, konsol, serta API lulus.
- 26 regresi UI termasuk retensi data, enam isian per halaman, filter, pencarian, mode review, unggahan opsional, fokus, serta dokumen tanpa isian lulus. Enam kasus E2E dokumen terdaftar dan typecheck lulus; suite browser otomatis tidak dijalankan pada sesi ini.
- Pemeriksaan browser nyata pada demo lokal: picker tertutup, formulir 130 isian dipaginasi, nilai tetap setelah maju/mundur dan kembali dari review, filter kosong tidak memutus pengetikan, pencarian lintas bagian, fokus pagination/reset pencarian/unggah logo benar, serta dokumen tanpa isian tampil jelas.
- Berita Acara Pembentukan Sanggar: PDF asli tampil, perubahan nomor menghasilkan blob pratinjau baru, Word dan PDF berhasil diunduh. Word 849.275 byte lolos pemeriksaan ZIP/OOXML; PDF 136.345 byte terbaca enam halaman dan memuat nomor percobaan `20/BA`.
- Formulir dan review diperiksa pada viewport desktop serta 390 × 844; tidak ada gulir horizontal pada ponsel. Viewport dikembalikan setelah pemeriksaan. Nilai percobaan dihapus dan tidak disimpan ke profil.
- Paket native UI/CSS pada hasil build sama dengan sumber yang diperiksa. Pengujian 216 berkas renderer dari perbaikan sebelumnya tidak diulang karena backend dan template tidak berubah. Perubahan ini hanya di repository lokal; belum diterapkan ke website produksi.

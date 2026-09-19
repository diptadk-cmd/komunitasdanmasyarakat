# Peta pengujian JakSanggar

Dokumen ini dihasilkan oleh `node scripts/feature-coverage.mjs` dari kode produksi. **Terdaftar dalam inventaris tidak berarti seluruh fitur telah lulus uji.**

## Menjalankan

```powershell
node scripts/feature-coverage.mjs
node --test tests/navigation-coverage.test.mjs
```

Hasil terstruktur: `reports/feature-coverage.json`. Perbarui inventaris setiap rute/menu berubah. Tes memakai paket Wouter dan regexparam yang dipakai aplikasi, bukan implementasi pencocokan tiruan.

## Cakupan otomatis lokal

Ditemukan 108 pola rute, 94 item menu per peran, 279 target statis, dan 116 ekspresi target dinamis.

Tes memeriksa pola rute dapat dikompilasi, contoh parameter diterima router, urutan rute tidak menelan rute statis, menu setiap peran menunjuk rute dengan peran yang sesuai, target internal statis menemukan rute, dan kedua aplikasi tidak mempunyai deklarasi rute yang belum dapat dibaca. Tautan jaringan, aset, anchor dan ekspresi dinamis dilaporkan terpisah.

Tes ini tidak mengirim data ke website produksi. Data demo lokal tidak membuktikan transaksi tersimpan di server.

## Matriks sembilan peran

| Peran | Menu terinventaris | Otomatis lokal | Perlu API dan akun uji | Perlu perangkat / pemeriksaan nyata |
| --- | ---: | --- | --- | --- |
| Kurator | 14 | Kontrak rute dan target menu; bukan alur transaksi | Sesi dan pembatasan akses; akun/blokir; kurasi; penugasan juri; dokumen; data, berita, tampilan, waktu, rekapan | Ekspor/cetak dokumen, unggah media, panggilan audio/video |
| Admin | 7 | Kontrak rute dan target menu; bukan alur transaksi | Hak kelola berita, banner, slider, info budaya; publikasi tampil di akun lain | Unggah gambar/video dan tampilan responsif |
| Sanggar | 19 | Kontrak rute dan target menu; bukan alur transaksi | Profil; keanggotaan; jadwal/absensi; kas/iuran/honor; kurasi; aset; kerja sama; pesanan sewa; dokumen | Dokumen PDF/DOCX, geolokasi, unggah, PWA, panggilan |
| Pelatih | 12 | Kontrak rute dan target menu; bukan alur transaksi | Daftar latih; profil; honor/slip; penugasan; kelas privat; sertifikat | Unggah bukti, unduh/cetak slip dan sertifikat, panggilan |
| Seniman | 12 | Kontrak rute dan target menu; bukan alur transaksi | Profil; absensi; tagihan/iuran; honor; penugasan; riwayat; sertifikat | Kamera/geolokasi absensi jika dipakai, unggah bukti, unduh, panggilan |
| Juri | 4 | Kontrak rute dan target menu; bukan alur transaksi | Sanggar yang ditugaskan; simpan skor; finalisasi; batas akses penilaian | Baca lampiran, cetak laporan, panggilan |
| Pengrajin | 7 | Kontrak rute dan target menu; bukan alur transaksi | Produk/stok/harga; pesanan; ongkir; verifikasi bayar; pengiriman; kanal dan kerja sama | Foto produk, dokumen transaksi/tanda tangan, notifikasi, panggilan |
| Mitra pengrajin | 9 | Kontrak rute dan target menu; bukan alur transaksi | Verifikasi toko dan pembatasan katalog; katalog/pesanan; kerja sama; layanan; pembayaran/penerimaan | Geolokasi toko, unggah NIB/surat, dokumen, panggilan |
| Konsumen | 10 | Kontrak rute dan target menu; bukan alur transaksi | Katalog lintas kategori; pesanan sewa; persetujuan; kontrak; pembayaran; status transaksi | Tanda tangan, unggah bukti, PDF/DOCX, panggilan |

## Prosedur verifikasi fungsi

1. Jalankan unit test dan typecheck repository, kemudian jalankan tes navigasi di atas.
2. Jalankan browser smoke test pada mode demo lokal untuk halaman, klik menu, pencarian, submenu, tema, drawer, dan ukuran layar. Catat hasil tes browser terpisah; inventaris ini tidak mengklaim tes tersebut telah dijalankan.
3. Pada API/database uji yang terisolasi, periksa CRUD → muat ulang → baca dari akun pasangan. Uji keberhasilan, validasi, akses peran lain, kegagalan jaringan, dan rollback.
4. Verifikasi dokumen berisi data yang benar; buka hasil PDF/DOCX, periksa halaman, tanda tangan, angka dan cetak.
5. Uji komunikasi dengan dua akun/perangkat: pesan, lampiran, indikator belum dibaca, mikrofon/kamera, panggilan masuk/tolak/berakhir, dan jaringan terputus.
6. Uji izin perangkat, instalasi PWA, unggah besar, email pemulihan, pembayaran dan penyimpanan server di lingkungan uji yang sesuai. Jangan menganggap stub atau demo sebagai pengujian layanan nyata.

## Rute dan menu dari source

### jak-sanggar (base /)

Rute: 93; menu: 80; tautan statis: 241; target dinamis: 93.

| Klasifikasi target statis | Jumlah |
| --- | ---: |
| external-or-browser-resource | 19 |
| route-matched | 213 |
| same-document | 9 |

| Pola rute | Peran yang terdeteksi dari Guard | Lokasi |
| --- | --- | --- |
| `/` | publik | artifacts/jak-sanggar/src/App.tsx:706 |
| `/lupa-password` | publik | artifacts/jak-sanggar/src/App.tsx:707 |
| `/daftar` | publik | artifacts/jak-sanggar/src/App.tsx:708 |
| `/daftar/sanggar` | publik | artifacts/jak-sanggar/src/App.tsx:709 |
| `/daftar/pelatih` | publik | artifacts/jak-sanggar/src/App.tsx:710 |
| `/daftar/seniman` | publik | artifacts/jak-sanggar/src/App.tsx:711 |
| `/daftar/konsumen` | publik | artifacts/jak-sanggar/src/App.tsx:712 |
| `/daftar/sewa` | publik | artifacts/jak-sanggar/src/App.tsx:713 |
| `/daftar/pengrajin` | publik | artifacts/jak-sanggar/src/App.tsx:716 |
| `/daftar/mitra` | publik | artifacts/jak-sanggar/src/App.tsx:717 |
| `/daftar/mitra-pengrajin` | publik | artifacts/jak-sanggar/src/App.tsx:718 |
| `/syarat-ketentuan` | publik | artifacts/jak-sanggar/src/App.tsx:721 |
| `/kebijakan-privasi` | publik | artifacts/jak-sanggar/src/App.tsx:722 |
| `/toko/pengrajin/:id` | publik | artifacts/jak-sanggar/src/App.tsx:723 |
| `/rekapan` | admin, juri, mitra_pengrajin, pelatih, pengrajin, sanggar, seniman, sewa | artifacts/jak-sanggar/src/App.tsx:725 |
| `/pesan` | admin, juri, mitra_pengrajin, pelatih, pengrajin, sanggar, seniman, sewa | artifacts/jak-sanggar/src/App.tsx:735 |
| `/mitra/layanan/pesanan/:id` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:739 |
| `/mitra/layanan/pesanan` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:750 |
| `/mitra/layanan/item/:id` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:761 |
| `/mitra/layanan/:kategori` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:772 |
| `/mitra/layanan` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:783 |
| `/mitra/katalog` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:794 |
| `/mitra/kerjasama` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:805 |
| `/mitra/paket` | publik | artifacts/jak-sanggar/src/App.tsx:816 |
| `/mitra/pesanan` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:819 |
| `/mitra/profil` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:830 |
| `/mitra` | mitra_pengrajin | artifacts/jak-sanggar/src/App.tsx:839 |
| `/mitra-pengrajin/*?` | publik | artifacts/jak-sanggar/src/App.tsx:851 |
| `/pengrajin/pesanan-produk` | pengrajin | artifacts/jak-sanggar/src/App.tsx:855 |
| `/pengrajin/toko-peta` | publik | artifacts/jak-sanggar/src/App.tsx:865 |
| `/pengrajin/produk` | pengrajin | artifacts/jak-sanggar/src/App.tsx:868 |
| `/pengrajin/kanal` | pengrajin | artifacts/jak-sanggar/src/App.tsx:877 |
| `/pengrajin/dokumen` | publik | artifacts/jak-sanggar/src/App.tsx:886 |
| `/pengrajin/profil` | pengrajin | artifacts/jak-sanggar/src/App.tsx:890 |
| `/pengrajin` | pengrajin | artifacts/jak-sanggar/src/App.tsx:900 |
| `/sanggar` | sanggar | artifacts/jak-sanggar/src/App.tsx:910 |
| `/sanggar/pusat-kendali` | sanggar | artifacts/jak-sanggar/src/App.tsx:919 |
| `/sanggar/profil` | sanggar | artifacts/jak-sanggar/src/App.tsx:928 |
| `/sanggar/karya` | sanggar | artifacts/jak-sanggar/src/App.tsx:937 |
| `/sanggar/dokumen` | sanggar | artifacts/jak-sanggar/src/App.tsx:946 |
| `/sanggar/keanggotaan` | sanggar | artifacts/jak-sanggar/src/App.tsx:955 |
| `/sanggar/rapor-apresiasi` | sanggar | artifacts/jak-sanggar/src/App.tsx:964 |
| `/sanggar/regenerasi` | sanggar | artifacts/jak-sanggar/src/App.tsx:973 |
| `/sanggar/latihan` | sanggar | artifacts/jak-sanggar/src/App.tsx:982 |
| `/sanggar/pembinaan` | sanggar | artifacts/jak-sanggar/src/App.tsx:991 |
| `/sanggar/kurasi` | sanggar | artifacts/jak-sanggar/src/App.tsx:1000 |
| `/sanggar/aset` | sanggar | artifacts/jak-sanggar/src/App.tsx:1009 |
| `/sanggar/sarpras` | sanggar | artifacts/jak-sanggar/src/App.tsx:1018 |
| `/sanggar/kerjasama` | sanggar | artifacts/jak-sanggar/src/App.tsx:1027 |
| `/sanggar/kerjasama/permintaan` | sanggar | artifacts/jak-sanggar/src/App.tsx:1036 |
| `/sanggar/kerjasama/:id` | sanggar | artifacts/jak-sanggar/src/App.tsx:1045 |
| `/sanggar/permintaan-sewa` | sanggar | artifacts/jak-sanggar/src/App.tsx:1054 |
| `/sanggar/permintaan-sewa/:id` | sanggar | artifacts/jak-sanggar/src/App.tsx:1063 |
| `/sanggar/buku-kas` | sanggar | artifacts/jak-sanggar/src/App.tsx:1072 |
| `/pelatih` | pelatih | artifacts/jak-sanggar/src/App.tsx:1082 |
| `/pelatih/daftar-latih` | pelatih | artifacts/jak-sanggar/src/App.tsx:1091 |
| `/pelatih/profil` | pelatih | artifacts/jak-sanggar/src/App.tsx:1100 |
| `/pelatih/absen` | pelatih | artifacts/jak-sanggar/src/App.tsx:1109 |
| `/pelatih/honor` | pelatih | artifacts/jak-sanggar/src/App.tsx:1118 |
| `/pelatih/slip` | pelatih | artifacts/jak-sanggar/src/App.tsx:1127 |
| `/pelatih/honor-proyek` | pelatih | artifacts/jak-sanggar/src/App.tsx:1136 |
| `/pelatih/permintaan-sdm` | pelatih | artifacts/jak-sanggar/src/App.tsx:1145 |
| `/pelatih/penugasan-sewa` | pelatih | artifacts/jak-sanggar/src/App.tsx:1154 |
| `/pelatih/penugasan-sewa/:id` | pelatih | artifacts/jak-sanggar/src/App.tsx:1163 |
| `/pelatih/kelas-privat/:id` | pelatih | artifacts/jak-sanggar/src/App.tsx:1172 |
| `/pelatih/kelas-privat` | pelatih | artifacts/jak-sanggar/src/App.tsx:1181 |
| `/pelatih/sertifikat` | pelatih | artifacts/jak-sanggar/src/App.tsx:1190 |
| `/seniman` | seniman | artifacts/jak-sanggar/src/App.tsx:1200 |
| `/seniman/profil` | seniman | artifacts/jak-sanggar/src/App.tsx:1209 |
| `/seniman/absen` | seniman | artifacts/jak-sanggar/src/App.tsx:1218 |
| `/seniman/keuangan` | seniman | artifacts/jak-sanggar/src/App.tsx:1227 |
| `/seniman/tagihan` | seniman | artifacts/jak-sanggar/src/App.tsx:1234 |
| `/seniman/honor-komersial` | seniman | artifacts/jak-sanggar/src/App.tsx:1243 |
| `/seniman/riwayat` | seniman | artifacts/jak-sanggar/src/App.tsx:1252 |
| `/seniman/permintaan-sdm` | seniman | artifacts/jak-sanggar/src/App.tsx:1261 |
| `/seniman/penugasan-sewa` | seniman | artifacts/jak-sanggar/src/App.tsx:1270 |
| `/seniman/penugasan-sewa/:id` | seniman | artifacts/jak-sanggar/src/App.tsx:1279 |
| `/seniman/sertifikat` | seniman | artifacts/jak-sanggar/src/App.tsx:1288 |
| `/juri` | juri | artifacts/jak-sanggar/src/App.tsx:1298 |
| `/juri/profil` | juri | artifacts/jak-sanggar/src/App.tsx:1307 |
| `/juri/:id` | juri | artifacts/jak-sanggar/src/App.tsx:1316 |
| `/admin` | admin | artifacts/jak-sanggar/src/App.tsx:1326 |
| `/admin/berita` | admin | artifacts/jak-sanggar/src/App.tsx:1335 |
| `/admin/banner` | admin | artifacts/jak-sanggar/src/App.tsx:1344 |
| `/admin/slider` | admin | artifacts/jak-sanggar/src/App.tsx:1353 |
| `/admin/info-budaya` | admin | artifacts/jak-sanggar/src/App.tsx:1362 |
| `/kurator/*?` | publik | artifacts/jak-sanggar/src/App.tsx:1373 |
| `/konsumen/pesanan/:id` | sewa | artifacts/jak-sanggar/src/App.tsx:1380 |
| `/konsumen/pesanan` | sewa | artifacts/jak-sanggar/src/App.tsx:1389 |
| `/konsumen/item/:id` | sewa | artifacts/jak-sanggar/src/App.tsx:1398 |
| `/konsumen/katalog/:kategori` | sewa | artifacts/jak-sanggar/src/App.tsx:1407 |
| `/konsumen` | sewa | artifacts/jak-sanggar/src/App.tsx:1416 |
| `/sewa/*?` | publik | artifacts/jak-sanggar/src/App.tsx:1426 |

| Peran | Menu | Target | Rute cocok |
| --- | --- | --- | --- |
| sanggar | Beranda | `/sanggar` | `/sanggar` |
| sanggar | Pusat Kendali AI | `/sanggar/pusat-kendali` | `/sanggar/pusat-kendali` |
| sanggar | Profil Sanggar | `/sanggar/profil` | `/sanggar/profil` |
| sanggar | Publikasi Karya | `/sanggar/karya` | `/sanggar/karya` |
| sanggar | Keanggotaan | `/sanggar/keanggotaan` | `/sanggar/keanggotaan` |
| sanggar | Keanggotaan / Rapor & Apresiasi | `/sanggar/rapor-apresiasi` | `/sanggar/rapor-apresiasi` |
| sanggar | Keanggotaan / Regenerasi | `/sanggar/regenerasi` | `/sanggar/regenerasi` |
| sanggar | Latihan | `/sanggar/latihan` | `/sanggar/latihan` |
| sanggar | Pembinaan | `/sanggar/pembinaan` | `/sanggar/pembinaan` |
| sanggar | Pembinaan / Kurasi Sanggar | `/sanggar/kurasi` | `/sanggar/kurasi` |
| sanggar | Aset & Sarana | `/sanggar/aset` | `/sanggar/aset` |
| sanggar | Aset & Sarana / Sarana & Prasarana | `/sanggar/sarpras` | `/sanggar/sarpras` |
| sanggar | Kerjasama | `/sanggar/kerjasama` | `/sanggar/kerjasama` |
| sanggar | Kerjasama / Permintaan | `/sanggar/kerjasama/permintaan` | `/sanggar/kerjasama/permintaan` |
| sanggar | Permintaan Layanan Masuk | `/sanggar/permintaan-sewa` | `/sanggar/permintaan-sewa` |
| sanggar | Buku Kas | `/sanggar/buku-kas` | `/sanggar/buku-kas` |
| sanggar | Tools Dokumen | `/sanggar/dokumen` | `/sanggar/dokumen` |
| sanggar | Rekapan | `/rekapan` | `/rekapan` |
| sanggar | Pesan & Percakapan | `/pesan` | `/pesan` |
| pelatih | Beranda | `/pelatih` | `/pelatih` |
| pelatih | Profil Saya | `/pelatih/profil` | `/pelatih/profil` |
| pelatih | Daftar Latih | `/pelatih/daftar-latih` | `/pelatih/daftar-latih` |
| pelatih | Pengajuan Honor | `/pelatih/honor` | `/pelatih/honor` |
| pelatih | Arsip E-Slip | `/pelatih/slip` | `/pelatih/slip` |
| pelatih | Dana Proyek | `/pelatih/honor-proyek` | `/pelatih/honor-proyek` |
| pelatih | Permintaan SDM | `/pelatih/permintaan-sdm` | `/pelatih/permintaan-sdm` |
| pelatih | Penugasan Sewa | `/pelatih/penugasan-sewa` | `/pelatih/penugasan-sewa` |
| pelatih | Pesanan Kelas Privat | `/pelatih/kelas-privat` | `/pelatih/kelas-privat` |
| pelatih | Sertifikat & Penghargaan | `/pelatih/sertifikat` | `/pelatih/sertifikat` |
| pelatih | Rekapan | `/rekapan` | `/rekapan` |
| pelatih | Pesan & Percakapan | `/pesan` | `/pesan` |
| seniman | Beranda | `/seniman` | `/seniman` |
| seniman | Profil Saya | `/seniman/profil` | `/seniman/profil` |
| seniman | Absen Latihan | `/seniman/absen` | `/seniman/absen` |
| seniman | Keuangan | `/seniman/keuangan` | `/seniman/keuangan` |
| seniman | Keuangan / Tagihan Saya | `/seniman/tagihan` | `/seniman/tagihan` |
| seniman | Keuangan / Dana Proyek Seni | `/seniman/honor-komersial` | `/seniman/honor-komersial` |
| seniman | Permintaan SDM | `/seniman/permintaan-sdm` | `/seniman/permintaan-sdm` |
| seniman | Penugasan Sewa | `/seniman/penugasan-sewa` | `/seniman/penugasan-sewa` |
| seniman | Riwayat | `/seniman/riwayat` | `/seniman/riwayat` |
| seniman | Sertifikat & Penghargaan | `/seniman/sertifikat` | `/seniman/sertifikat` |
| seniman | Rekapan | `/rekapan` | `/rekapan` |
| seniman | Pesan & Percakapan | `/pesan` | `/pesan` |
| juri | Tugas Penilaian | `/juri` | `/juri` |
| juri | Profil Saya | `/juri/profil` | `/juri/profil` |
| juri | Rekapan | `/rekapan` | `/rekapan` |
| juri | Pesan & Percakapan | `/pesan` | `/pesan` |
| admin | Beranda | `/admin` | `/admin` |
| admin | Konten | `/admin/berita` | `/admin/berita` |
| admin | Konten / Banner | `/admin/banner` | `/admin/banner` |
| admin | Konten / Slider | `/admin/slider` | `/admin/slider` |
| admin | Konten / Informasi Kebudayaan | `/admin/info-budaya` | `/admin/info-budaya` |
| admin | Rekapan | `/rekapan` | `/rekapan` |
| admin | Pesan & Percakapan | `/pesan` | `/pesan` |
| sewa | Beranda Konsumen | `/konsumen` | `/konsumen` |
| sewa | Sanggar | `/konsumen/katalog/sanggar` | `/konsumen/katalog/:kategori` |
| sewa | SDM | `/konsumen/katalog/sdm` | `/konsumen/katalog/:kategori` |
| sewa | Perlengkapan | `/konsumen/katalog/perlengkapan` | `/konsumen/katalog/:kategori` |
| sewa | Kostum | `/konsumen/katalog/kostum` | `/konsumen/katalog/:kategori` |
| sewa | Tempat Latihan | `/konsumen/katalog/tempat` | `/konsumen/katalog/:kategori` |
| sewa | Kerajinan & Jasa | `/konsumen/katalog/kerajinan` | `/konsumen/katalog/:kategori` |
| sewa | Pesanan Saya | `/konsumen/pesanan` | `/konsumen/pesanan` |
| sewa | Rekapan | `/rekapan` | `/rekapan` |
| sewa | Pesan & Percakapan | `/pesan` | `/pesan` |
| pengrajin | Beranda | `/pengrajin` | `/pengrajin` |
| pengrajin | Profil Toko | `/pengrajin/profil` | `/pengrajin/profil` |
| pengrajin | Produk Khas Jakarta | `/pengrajin/produk` | `/pengrajin/produk` |
| pengrajin | Order & Dokumen Transaksi | `/pengrajin/pesanan-produk` | `/pengrajin/pesanan-produk` |
| pengrajin | Layanan & Kerja Sama | `/pengrajin/kanal` | `/pengrajin/kanal` |
| pengrajin | Rekapan | `/rekapan` | `/rekapan` |
| pengrajin | Pesan & Percakapan | `/pesan` | `/pesan` |
| mitra_pengrajin | Profil & Marketplace | `/mitra/profil` | `/mitra/profil` |
| mitra_pengrajin | Ringkasan Mitra | `/mitra` | `/mitra` |
| mitra_pengrajin | Katalog Pengrajin | `/mitra/katalog` | `/mitra/katalog` |
| mitra_pengrajin | Sanggar & Layanan | `/mitra/layanan` | `/mitra/layanan` |
| mitra_pengrajin | Kerja Sama Masuk | `/mitra/kerjasama` | `/mitra/kerjasama` |
| mitra_pengrajin | Pesanan & Dokumen Transaksi | `/mitra/pesanan` | `/mitra/pesanan` |
| mitra_pengrajin | Pesanan Layanan | `/mitra/layanan/pesanan` | `/mitra/layanan/pesanan` |
| mitra_pengrajin | Rekapan | `/rekapan` | `/rekapan` |
| mitra_pengrajin | Pesan & Percakapan | `/pesan` | `/pesan` |

### konsol (base /konsol)

Rute: 15; menu: 14; tautan statis: 38; target dinamis: 23.

| Klasifikasi target statis | Jumlah |
| --- | ---: |
| route-matched | 37 |
| same-document | 1 |

| Pola rute | Peran yang terdeteksi dari Guard | Lokasi |
| --- | --- | --- |
| `/` | kurator, publik | artifacts/konsol/src/App.tsx:179 |
| `/pesan` | kurator | artifacts/konsol/src/App.tsx:180 |
| `/akun` | kurator | artifacts/konsol/src/App.tsx:183 |
| `/manajemen` | kurator | artifacts/konsol/src/App.tsx:192 |
| `/dokumen` | kurator | artifacts/konsol/src/App.tsx:201 |
| `/kurasi` | kurator | artifacts/konsol/src/App.tsx:210 |
| `/penugasan` | kurator | artifacts/konsol/src/App.tsx:219 |
| `/kerjasama` | kurator | artifacts/konsol/src/App.tsx:228 |
| `/info-budaya` | kurator | artifacts/konsol/src/App.tsx:237 |
| `/media-kreatif` | kurator | artifacts/konsol/src/App.tsx:246 |
| `/pengumuman` | kurator | artifacts/konsol/src/App.tsx:255 |
| `/staff` | kurator | artifacts/konsol/src/App.tsx:264 |
| `/tampilan` | kurator | artifacts/konsol/src/App.tsx:273 |
| `/waktu` | kurator | artifacts/konsol/src/App.tsx:282 |
| `/rekapan` | kurator | artifacts/konsol/src/App.tsx:291 |

| Peran | Menu | Target | Rute cocok |
| --- | --- | --- | --- |
| kurator | Dasbor | `/` | `/` |
| kurator | Akun Pengguna | `/akun` | `/akun` |
| kurator | Manajemen Data | `/manajemen` | `/manajemen` |
| kurator | Studio Dokumen | `/dokumen` | `/dokumen` |
| kurator | Sistem Kurasi | `/kurasi` | `/kurasi` |
| kurator | Penugasan Juri | `/penugasan` | `/penugasan` |
| kurator | Pengawasan Kerjasama | `/kerjasama` | `/kerjasama` |
| kurator | Media Kreatif | `/media-kreatif` | `/media-kreatif` |
| kurator | Berita & Pengumuman | `/pengumuman` | `/pengumuman` |
| kurator | Admin & Juri | `/staff` | `/staff` |
| kurator | Tampilan | `/tampilan` | `/tampilan` |
| kurator | Waktu & Sistem | `/waktu` | `/waktu` |
| kurator | Rekapan | `/rekapan` | `/rekapan` |
| kurator | Pesan & Percakapan | `/pesan` | `/pesan` |

## Temuan dan batas cakupan

- Rute yang cocok belum membuktikan halaman berhasil dimuat atau proses bisnis berhasil.
- Tautan dinamis belum dievaluasi; nilainya dapat bergantung pada data, peran, dan server.
- Guard autentikasi/otorisasi belum dijalankan oleh tes statis ini.
- Fallback NotFound tidak dihitung sebagai rute valid.
- Skema http/https/mailto/tel/data/blob dan URL // diinventaris sebagai pengecualian jaringan, bukan lulus fungsi.
- Inventaris seluruh src mencakup komponen yang mungkin tidak lagi dijangkau dari App.

Target statis tanpa rute: **0**. Deklarasi rute tidak terbaca: **0**.

Ekspresi dinamis dan seluruh target beserta lokasi tersedia di JSON. Pengecualian tidak dihapus diam-diam: setiap target mempunyai klasifikasi dan alasan bila tidak dicocokkan dengan router.

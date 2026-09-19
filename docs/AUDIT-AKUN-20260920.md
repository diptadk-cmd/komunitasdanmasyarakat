# Audit akun dan alur input–output — 20 September 2026

Audit ini mencakup sembilan peran pada repository lokal JakSanggar. Pemeriksaan menggabungkan pembacaan kode, tes logika/sinkronisasi dengan data sintetis, dan pemeriksaan browser CUA oleh agen utama. **Halaman berhasil dibuka belum membuktikan seluruh transaksi di dalamnya berhasil.** Tidak ada perubahan atau transaksi audit yang dikirim ke website produksi.

## Perbaikan yang dibuktikan

| Masalah | Sebelum | Setelah | Bukti otomatis |
|---|---|---|---|
| Kehadiran Pelatih | Tombol hadir menimpa `latihan.pelatihId`; penugasan instruktur dianggap sudah hadir | Kehadiran menjadi record `absensiLatihan` sendiri. Penugasan tetap utuh, klik ulang tidak menggandakan absen, anggota tidak aktif/sanggar lain ditolak | `latihan-anggota.test.mjs` |
| Pengajuan honor berulang | Setiap pengajuan menghitung kembali seluruh laporan latihan | Hanya sesi yang ditugaskan, dihadiri, dilaporkan, dan belum diklaim yang dihitung. ID sesi ikut tersimpan; nominal berasal dari tarif dan jumlah sesi | `latihan-anggota.test.mjs`, `member-sync-policy.test.ts` |
| Perubahan anggota berhenti di perangkat | Antrean dan API menolak pengajuan honor Pelatih, bukti iuran Seniman, serta konfirmasi dana proyek anggota | Pengecualian khusus untuk aksi milik anggota aktif. Server memeriksa afiliasi, pemilik, status, field yang boleh berubah, tarif dan sesi honor | `member-finance-sync.test.mjs`, `member-sync-policy.test.ts` |
| Absensi memakai dua jalur penulisan | Selain store, halaman Seniman mengirim POST terpisah dengan cookie; jalur tersebut tidak mengikuti token sesi per tab | Pelatih dan Seniman memakai helper kehadiran serta antrean store yang sama. Kehadiran dikirim sebelum pengajuan honor dalam batch | `latihan-anggota.test.mjs`, `member-finance-sync.test.mjs` |
| Akses penilaian Juri pada demo | URL detail dapat dibuka tanpa mengecek penugasan; jalur demo melewati validasi API | Penugasan/pengajuan diperiksa untuk akses, lalu diperiksa ulang sebelum simpan. Nilai final dapat dibaca tetapi tidak ditulis ulang | `kurasi-access.test.mjs` |
| Rincian skor Juri tertinggal | Ringkasan kontribusi indikator membaca skor lama ketika input per bukti berubah | Rincian kontribusi memakai agregasi terbaru yang juga digunakan total nilai | Review pemanggilan `indikatorKontribusi`; tes agregasi kurasi yang sudah tersedia |
| Harga produk dari snapshot lama | Checkout biasa/paket dapat menyimpan harga/nama lama, produk ditarik, atau paket tanpa seluruh barangnya | Pesanan membaca katalog dan rekening toko terbaru. Produk tidak tersedia ditolak; kegagalan satu produk membatalkan penyimpanan seluruh paket | `kerjasama-sewa-flow.test.mjs` |
| Bukti pembayaran anggota | Bukti yang sudah tersimpan belum memiliki keluaran unduh yang konsisten | Iuran Seniman memakai pembaca berkas tervalidasi; bukti iuran dan slip/distribusi Pelatih memakai komponen unduh bersama. Nama berkas lama diberi penjelasan | Helper `payment-receipt.ts` dan komponen `ReceiptDownload`, dikerjakan bersama agen utama |
| Field pengelola melalui profil sendiri | Self-PATCH dapat mengubah status keanggotaan, afiliasi, tarif, atau identitas bersarang; kebijakan honor kemudian mempercayai nilainya | Self-edit mengabaikan status/afiliasi/tarif/rapor/identitas milik server. Pendaftaran memaksa pending dan tarif awal nol; Sanggar/Kurator menetapkan tarif | `member-profile-policy.test.ts` |
| Penyuntingan profil anggota biasa | UI memakai `/members/:id`, tetapi endpoint tersebut menolak self-edit | Pemilik dapat menyimpan nama, kontak, foto, dan portofolio. Perubahan peran tetap ditolak; hak pengelola Sanggar/Kurator dipertahankan. Klien menerapkan kembali respons server | `member-profile-policy.test.ts`, `member-profile-sync.test.mjs` |

Pengajuan honor lama yang belum mempunyai daftar ID sesi diperlakukan konservatif: laporan yang sudah ada saat pengajuan lama dibuat tidak otomatis diajukan lagi. Pemeriksaan server juga mengunci baris akun Pelatih saat memproses pengajuan untuk menserialkan permintaan bersamaan. Perilaku transaksi database dan persaingan permintaan ini masih memerlukan uji integrasi database; tes kebijakan murni tidak menggantikannya.

## Matriks peran

Kolom otomatis menjelaskan alur yang benar-benar diperiksa lewat kode atau tes. Jumlah menu berasal dari navigasi browser aktual oleh agen utama, bukan jumlah skenario transaksi.

| Peran | Input → keluaran yang ditinjau | Bukti kode/otomatis | Browser CUA lokal | Batas yang masih perlu diuji |
|---|---|---|---|---|
| Kurator | Akun/izin, penugasan Juri, matriks, moderasi → direktori/tugas/nilai/konten | Fixture dan persistensi demo, normalisasi matriks, snapshot kurasi, sinkronisasi/tombstone global | Login form berhasil; 14 tujuan menu dibuka | CRUD akun lintas perangkat, otorisasi seluruh aksi API, pemulihan kegagalan jaringan |
| Admin | Judul/isi berita → daftar berita Admin dan slider Sanggar | Validasi kosong, izin halaman, persistensi global; tes sinkronisasi yang tersedia | Login; 7 menu; tombol berita kosong nonaktif; berita uji tersimpan dan dibaca dari Sanggar | Publikasi melalui API/database dan unggah media produksi |
| Sanggar | Jadwal/penugasan → absensi/honor anggota; kas dan dokumen | Helper kehadiran/honor, hubungan sanggar, profil/aset, dokumen dan transaksi yang tersedia | Login; 19 menu; berita Admin tampil | Simpan jadwal/laporan GPS, validasi honor/iuran sampai database dan reload akun pasangan |
| Pelatih | Kehadiran → record absen; sesi hadir+laporan → pengajuan/total/slip | Tes kehadiran, sesi unik, tarif, klaim lama; antrean HTTP tiruan dan kebijakan API | Login; 12 menu | Pembayaran honor nyata, sinkronisasi dua perangkat, dokumen slip setelah pembayaran |
| Seniman | Absen/bukti iuran/konfirmasi dana → status dan bukti unduh | Validasi anggota, pembaca bukti bersama, antrean iuran/distribusi dan larangan mengubah nominal/status lunas sendiri | Login; 12 menu | Verifikasi Sanggar melalui API, reload dan unduh pada perangkat lain |
| Juri | Patokan per bukti → agregasi/draft/final | Matriks, persyaratan/agregasi, penugasan dan kunci final; perbaikan sumber angka kontribusi | Login; 4 menu | Isi seluruh skor lalu finalisasi sampai server; tampilan rincian setiap kombinasi matriks |
| Pengrajin | Harga/kanal/ongkir → katalog, pesanan dan total | Harga katalog terbaru, produk ditarik, lifecycle produk/sewa dan status lintas tab yang sudah tersedia | Login; 7 menu | Publikasi produk, stok, bukti kirim dan pembayaran lintas akun melalui server |
| Mitra pengrajin | Keranjang/paket → pesanan produk/biaya | Harga dan rekening terkini, jumlah multi-produk, paket gagal utuh, isolasi pesanan, status ongkir lintas tab | Login; 9 menu | Verifikasi toko, negosiasi kerja sama, pembayaran/BAST sampai database |
| Konsumen | Periode/jumlah/katalog → kontrak, invoice, pembayaran dan pengembalian sewa | Lifecycle helper sewa, pembatalan, kewajiban pengembalian, kebijakan transaksi dan rekapan | Login; 10 menu | Pemesanan lengkap di API dengan Sanggar/SDM, unggah bukti, pengiriman dan penerimaan |

Browser memeriksa **94 tujuan menu**, judul halaman, serta keadaan setelah navigasi: tidak ditemukan alert, halaman tidak ditemukan, atau overflow horizontal desktop. `/seniman/keuangan` yang beralih ke tagihan merupakan alias yang disengaja. Halaman Pesan pada mode demo menjelaskan bahwa komunikasi memerlukan akun yang terdaftar di server; ini bukan bukti bahwa chat/panggilan telah berfungsi pada seluruh peran.

Berita uji lokal berjudul “Uji lokal input-output 20 September” dibuat pada akun Admin dan muncul pada slider berita Sanggar. Ini membuktikan alur lokal lintas peran pada origin demo yang sama, bukan publikasi ke database produksi.

## Pemeriksaan input dan keluaran nyata di browser

Seluruh data berikut sintetis, pada `localhost:5180` dan konsol demo `localhost:52741/konsol/`. Tidak ada pemesanan atau pembayaran nyata yang dilakukan. Data uji yang tersimpan tetap terlihat pada akun demo.

| Alur | Hasil yang diamati |
|---|---|
| Berita Admin → Sanggar | Judul/isi kosong menonaktifkan publikasi. Berita berjudul “Uji lokal input-output 20 September” tersimpan pada Admin dan tampil di beranda Sanggar. |
| Buku kas | Pemasukan contoh Rp125.000 tampil pada ledger dan saldo, tetap ada setelah muat ulang. CSV hasil unduhan berisi debit `125000`, kredit `0`, saldo `125000`, serta keterangan yang diinput. |
| Profil Juri | Bio “Catatan uji profil lokal 20 September 2026.” tersimpan dan tetap tampil setelah muat ulang. Word 8.069 byte valid sebagai DOCX, PDF 50.922 byte satu halaman; keduanya memuat persis bio tersimpan. PDF juga diperiksa secara visual. |
| Produk Pengrajin → Mitra | Produk “Kriya Uji Lokal 20 September” dengan harga Rp175.000 dan stok 3 tersimpan. Katalog Mitra membaca harga yang sama; jumlah 2 menghasilkan subtotal Rp350.000. Keranjang dikosongkan sebelum pesanan final. |
| Pencarian Konsumen | Kata kunci sintetis yang tidak cocok menghasilkan keadaan kosong; “Demo Data Lengkap” menghasilkan satu sanggar yang sesuai. |
| Pembuat kop | Nama kosong menonaktifkan penerapan. Nama, identitas, alamat, kontak dan pilihan Modern muncul pada pratinjau. PNG 1800 × 258 px dan PDF A4 satu halaman berhasil diunduh serta dibaca parser. |
| Kop → dokumen | Kop diterapkan, disimpan, dan tetap ada setelah muat ulang. SHA-256 PNG unduhan sama dengan `word/media/native-letterhead.png` dalam DOCX hasil ekspor. PDF dokumen lengkap enam halaman menampilkan kop di atas isi surat; tampilan halaman pertama diperiksa secara visual. Isian yang belum lengkap tetap berupa draf. |
| Responsif | Beranda sembilan peran pada lebar 390 px tidak mengalami overflow horizontal. Formulir dokumen dan dialog kop diperiksa pada ukuran ponsel, termasuk akses tombol unduh dan penerapan. |

Unggah logo/bukti positif melalui browser otomatis belum terverifikasi: ekstensi browser mengirim berkas berukuran nol ketika izin akses file lokal belum aktif. Aplikasi menolak berkas tersebut. Pemeriksaan pembaca berkas nyata, tipe/ukuran, dan bukti pembayaran dilakukan melalui tes terarah; hasil ini tidak menggantikan unggah melalui browser. Panduan kop tersedia di [PANDUAN-KOP-SURAT.md](PANDUAN-KOP-SURAT.md).

Pengujian profil menemukan kegagalan nyata tambahan: Vite menolak impor relatif modul layanan dokumen di `public/assets`. Pemuat bersama kini memakai URL absolut pada origin yang sama dan mengikuti `BASE_URL`. Middleware demo juga mendukung dokumen HTML profil, dengan pembatasan loopback/origin, ukuran 8 MB dan field keluaran yang dibolehkan tetap berlaku. Ekspor Word/PDF profil diulang melalui browser setelah perbaikan dan menghasilkan berkas pada tabel di atas. Autentikasi API produksi tetap berlaku.

## Hasil pengujian akhir

Perintah `corepack pnpm test:quick` setelah seluruh perbaikan menghasilkan:

| Workspace | Lulus | Gagal | Dilewati |
|---|---:|---:|---:|
| Logika bersama | 81 | 0 | 0 |
| Renderer dokumen | 20 | 0 | 0 |
| Aplikasi utama | 156 | 0 | 0 |
| Konsol | 16 | 0 | 0 |
| API | 97 | 0 | 1 |
| **Total** | **370** | **0** | **1** |

Selain itu, 11 tes rute/navigasi, TypeScript seluruh workspace, dan build aplikasi utama, konsol serta API lulus. Pemeriksaan cakupan menemukan 108 pola rute dan 94 item navigasi, tanpa rute hilang/tidak terselesaikan. `test:e2e:list` berhasil menemukan 60 skenario; skenario tersebut hanya diinventarisasi, bukan dijalankan. API lokal dimulai ulang dengan hasil build baru dan `/api/healthz` mengembalikan `ok`. Seed akun/konten demo dinonaktifkan saat restart.

Log: `output/audit-final-20260920.log` dan `output/test-reports/`. Ringkasan tersimpan di [laporan JSON](../reports/verification-account-audit-20260920.json). Tes database komunikasi bersyarat dilewati karena database QA khusus tidak disediakan. Tes antrean memakai respons HTTP tiruan; tes kebijakan API tidak membuka database.

Tinjauan silang menambahkan tujuh regresi perlindungan profil: enam kebijakan API dan satu penerapan respons server pada klien, semuanya termasuk dalam total di atas. Pemeriksaan ini tidak mengaudit ulang nilai tarif/status yang mungkin sudah tersimpan sebelum perbaikan.

Suite browser Playwright lengkap tidak dijalankan dalam audit ini. Pemeriksaan CUA, unit, dan kode memiliki cakupan berbeda. Email, kamera/GPS, panggilan dua perangkat, transaksi database, semua kombinasi unggahan dan seluruh output dokumen masih memerlukan pengujian integrasi sesuai [panduan pengujian](PENGUJIAN.md). Hasil 216 konversi native pada 19 September tercatat terpisah di [laporan perbaikan dokumen](PERBAIKAN-DOKUMEN-20260919.md); angka tersebut tidak dihitung ulang sebagai hasil audit hari ini.

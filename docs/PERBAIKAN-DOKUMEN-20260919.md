# Perbaikan generator dokumen — 19 September 2026

Pratinjau, unduhan Word, dan unduhan PDF native kembali bekerja pada aplikasi lokal. Perbaikan belum diterapkan ke server produksi.

## Penyebab dan perbaikan

Permintaan `POST /api/documents/render` pada aplikasi lokal semula mendapat HTTP 503, “Generator dokumen belum tersedia”. API menggunakan alamat bawaan Docker `http://renderer:3001/render`, sementara komputer pengembangan tidak menjalankan layanan tersebut dan source renderer belum tersedia di repository aplikasi.

Source dipulihkan dari `jaksanggar-help-20260915/renderer` ke `services/document-renderer`, kemudian disesuaikan untuk Windows dan Linux. Renderer menggunakan katalog dan template asli pada `artifacts/jak-sanggar/public/dokumen-fix`. Pemeriksaan aset menemukan 14 kelompok dan 202 template yang dirujuk katalog; seluruh berkas tersedia dan paket DOCX lolos pemeriksaan ZIP/struktur dasar.

API pengembangan kini memakai `http://127.0.0.1:3001/render` jika tidak ada konfigurasi khusus. Alamat bawaan produksi tetap memakai layanan Docker. Launcher memastikan renderer lokal siap untuk konfigurasi bawaan; API dengan `DOCUMENT_RENDERER_URL` khusus memakai layanan yang dikonfigurasi tersebut. LibreOffice mengonversi template native ke PDF dengan profil sementara terpisah. API tetap memerlukan autentikasi.

Mode demo mendapat middleware Vite khusus pengembangan untuk permintaan template native. Middleware memeriksa alamat loopback, origin lokal, jenis permintaan, dan batas body 8 MB; HTML bebas tidak diteruskan melalui jalur ini. Permintaan yang gagal mengembalikan pesan JSON, sehingga tidak berubah menjadi halaman fallback aplikasi.

Cache dependensi Vite aplikasi utama dan konsol juga dipisahkan menurut port. Sebelumnya, beberapa server pengembangan bersamaan dapat berbagi hasil optimasi React yang berubah dan menimbulkan kesalahan hook pada halaman yang masih terbuka. Muat ulang halaman setelah pembaruan server.

Daftar dokumen kini mengikuti alur pembentukan: berita acara pembentukan organisasi/sanggar (atau forum penetapan sesuai kelompok), keputusan pembentukan, AD/ART, pedoman, lalu dokumen pengelolaan dan operasional. Dokumen pertama otomatis terpilih saat membuka atau mengganti kelompok. Pengurutan hanya mengubah tampilan; 14 kelompok dan 202 template asli tetap utuh. Urutan organisasi induk dan sanggar nonbadan hukum telah diperiksa langsung melalui browser.

## Bukti pemeriksaan

| Pemeriksaan | Hasil dan batas |
|---|---|
| Seluruh template melalui renderer HTTP lokal | 202/202 Word berhasil; paket DOCX diperiksa, termasuk substitusi data uji jika template memiliki field |
| PDF native dengan LibreOffice | 14/14 berhasil, satu dokumen per kelompok; semua PDF dapat dibaca parser, total 89 halaman |
| Total pemeriksaan berkas nyata | 216/216 lulus; rincian ada di `output/test-reports/documents/summary.json` |
| Browser pengguna pada `localhost:5173` melalui CUA | Pratinjau enam halaman tampil; unduhan Word 847.919 byte dan PDF 248.195 byte terverifikasi melalui UI unduhan |
| Demo pada `localhost:5180` melalui CUA | Pratinjau memakai URL blob dan tampil tanpa alert kegagalan |
| Regresi middleware demo | Pemeriksaan rute, batas akses, body, tujuan renderer, dan kegagalan koneksi lulus |

Uji Word tidak menjamin setiap kombinasi isian/gambar menghasilkan tata letak yang sempurna. Uji PDF mencakup 14 sampel, bukan konversi seluruh 202 template. Jalur HTML/Chromium, seluruh alur CRUD, dan layanan produksi tidak tercakup dalam 216 pemeriksaan tersebut. Suite Playwright lengkap sudah disiapkan, tetapi belum dijalankan; hasil CUA di atas merupakan pemeriksaan manual yang terpisah.

## Menjalankan kembali

Pasang dependensi workspace dan LibreOffice, lalu jalankan `MULAI-GENERATOR-DOKUMEN.bat` atau `corepack pnpm run dev:renderer`. LibreOffice pada lokasi standar Windows terdeteksi otomatis. Jika menggunakan lokasi lain, tetapkan `LIBREOFFICE_PATH` pada `.env` atau lingkungan proses. Skrip membaca `.env` tanpa menimpa nilai lingkungan yang sudah ditetapkan. Di Ubuntu diperlukan `libreoffice-writer` dan font yang sesuai, misalnya `fonts-liberation`.

Kesiapan native tersedia pada `http://127.0.0.1:3001/healthz`; kegagalan prasyarat menghasilkan status 503. Log generator berada di `output/renderer.log`. Proses latar belakang tetap berjalan ketika jendela launcher ditutup. Bila konfigurasi berubah, mulai ulang renderer dan API yang sebelumnya sudah aktif.

Jalankan `corepack pnpm run test:documents` untuk mengulangi konversi seluruh Word dan satu PDF per kelompok. Perintah ini menggunakan renderer lokal port 3001 dan data sintetis, tanpa transaksi ke website publik. `test:quick` melewati konversi berkas nyata dan browser. Petunjuk seluruh pemeriksaan ada pada [Pengujian](PENGUJIAN.md), sedangkan kontrak renderer ada pada [README layanan](../services/document-renderer/README.md).

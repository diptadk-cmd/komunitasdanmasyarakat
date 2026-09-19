# Aset identitas JakSanggar

Aset ini dibuat pada 19 September 2026 untuk pembaruan dashboard JakSanggar.

Logo `jak-sanggar-mark-v2.png` merupakan gambar raster transparan 1254 × 1254 piksel yang dibuat melalui skill `imagegen` dengan built-in image generator. Dua figur komunitas Betawi mengapit monumen/tunas, dengan palet navy, jade, dan gold. Brief, prompt, serta catatan pemeriksaan tersedia dalam [brand-brief.md](brand-brief.md). PNG masih memiliki sedikit variasi warna dan tepi raster; file ini bukan master vektor.

Logo aplikasi tersimpan di [aplikasi utama](../../artifacts/jak-sanggar/src/assets/brand/jak-sanggar-mark-v2.png) dan [konsol kurator](../../artifacts/konsol/src/assets/brand/jak-sanggar-mark-v2.png). Dashboard memakai aset ini sebagai logo bawaan. Logo kustom yang telah dikonfigurasi melalui `appearance.brand.logoDataUrl` tetap diutamakan.

Tiga ikon berikut digambar langsung sebagai SVG untuk antarmuka, menggunakan `viewBox="0 0 24 24"`, `stroke="currentColor"`, ketebalan garis 1.7, tanpa isian, serta ujung dan sambungan membulat:

- [Komunitas Jakarta](komunitas-jak.svg): figur komunitas mengapit tugu.
- [Ondel-ondel Betawi](ondel-ondel.svg): wajah dan mahkota sederhana.
- [Pucuk rebung](pucuk-rebung.svg): motif geometris pertumbuhan.

Versi komponen React dan label pilihan ikon ada di [brandIcons.tsx](../../lib/jaksanggar-core/src/brandIcons.tsx). SVG mengikuti warna teks induknya; gunakan komponen tersebut untuk tampilan kecil dan penskalaan yang tajam. Logo PNG dan ikon SVG dibuat melalui proses berbeda dan bukan hasil konversi satu sama lain.

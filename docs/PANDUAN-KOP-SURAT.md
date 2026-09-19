# Pembuat kop surat di Tools Dokumen

Buka akun sanggar → **Tools Dokumen** → **Buat kop surat**. Tombol yang sama juga tersedia pada bagian **Logo, stempel, dan kop surat**.

1. Periksa nama organisasi yang diambil dari profil sanggar. Nama wajib diisi; identitas tambahan, alamat, telepon, email, dan situs web boleh dikosongkan.
2. Gunakan logo yang sudah tersedia, unggah logo dari perangkat, atau pilih **Lepas logo**. Berkas PNG, JPG, WebP, atau AVIF dibatasi 8 MB; format dan resolusinya diperiksa. Alamat gambar dari situs lain tidak diambil.
3. Pilih **Klasik** untuk teks di tengah dan garis ganda, atau **Modern** untuk teks rata kiri dengan garis hijau. Pratinjau diperbarui setelah isian berubah.
4. **Unduh PNG** menghasilkan gambar bagian kop saja. **Unduh PDF kop** menghasilkan satu halaman A4 dengan kop di atas dan ruang isi surat yang kosong.
5. **Gunakan kop ini** memasang gambar kop ke dokumen yang sedang dibuka. Klik **Simpan isian** untuk menyimpan kop bersama isian pada kelompok dokumen tersebut. Gunakan **Pratinjau** untuk melihat kop pada Word/PDF lengkap.

Teks panjang dibungkus ke baris berikutnya. Bila isi melebihi ruang kop, unduh dan penerapan dinonaktifkan sampai isian diringkas; teks tidak dipotong diam-diam. Logo mempertahankan perbandingan lebar dan tingginya. Menutup pembuat kop tidak mengubah kop yang sudah diterapkan. Isian pembuat tetap tersedia selama kelompok dokumen yang sama masih terbuka; data yang belum diterapkan/disimpan tidak dijamin bertahan setelah halaman dimuat ulang.

## Implementasi dan pemeriksaan

- Komponen: `artifacts/jak-sanggar/src/components/documents/LetterheadBuilder.tsx`.
- Pembungkusan, validasi dan ekspor: `artifacts/jak-sanggar/src/lib/letterhead.ts`.
- Gambar PNG: lebar 1800 px, tinggi maksimal 338 px, data URL maksimal 550.000 karakter. Batas ini mengikuti slot kop pada renderer native (maksimal 160 × 30 mm).
- Kop memakai slot `letterhead` dan disimpan sebagai `__image_letterhead`; logo profil dan gambar lain tidak diganti. Perubahan kop membatalkan pratinjau lama.
- PDF menggunakan dependensi jsPDF yang sudah tersedia dan dimuat saat ekspor. Format A4 dan penyisipan gambar mengikuti [dokumentasi resmi jsPDF](https://parallax.github.io/jsPDF/docs/jsPDF.html).

Pemeriksaan terarah:

```powershell
cd artifacts/jak-sanggar
node --experimental-strip-types --test test/letterhead.test.mjs test/native-document-form-ui.test.mjs
```

Tes mencakup dua tata letak, pembungkusan kata panjang, penolakan ruang berlebih/nama kosong/logo tidak valid, perbandingan ukuran logo, PDF A4 yang memiliki objek gambar, serta penerapan kop ke permintaan render dan penyimpanan tanpa kehilangan isian dokumen. Pengujian ini tidak menggantikan pemeriksaan visual di peramban untuk tampilan, scroll modal, keyboard, dan decoder gambar.

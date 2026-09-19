# Bantuan dan isian otomatis Tools Dokumen

Di Tools Dokumen, data yang tersedia dari profil dan isian tersimpan langsung digunakan. Ikon **?** pada setiap kolom menjelaskan artinya, cara mengisi, sumber yang perlu diperiksa, dan contoh penulisan. Pilihan yang sesuai tersedia di dalam bantuan; teks sendiri tetap dapat digunakan.

## Apa itu dasar pemberian mandat?

Dasar pemberian mandat adalah dokumen atau keputusan yang memberi pengelola kewenangan menjalankan tugas tertentu. Rujukannya dapat berupa keputusan rapat, surat keputusan, surat kuasa, atau surat penugasan yang benar-benar ada.

Klik **?** pada **Dasar pemberian mandat**, pilih jenis rujukan, lalu lengkapi pemberi mandat, nomor/tanggal bila tersedia, dan tugas yang diberikan. Contoh pola penulisan:

> Keputusan rapat [nama penyelenggara] tanggal [tanggal] tentang pemberian mandat [tugas sesuai dokumen] kepada [pengelola].

Bagian dalam kurung siku adalah petunjuk untuk diganti dengan data sendiri. Memilih jenis rujukan belum membuktikan mandat dan tidak otomatis membuat nomor keputusan. Jika sumber belum tersedia, konfirmasikan kepada pemberi mandat dan pertahankan dokumen sebagai draf.

## Cara memakai autofill

1. Lengkapi profil sanggar terlebih dahulu. Nama, alamat, kontak dan pengurus yang sudah tercatat dapat digunakan kembali.
2. Pilih dokumen sesuai kedudukan sanggar. Isian tersimpan pada kelompok dokumen tersebut tetap dipertahankan.
3. Isi data sumber. Tanggal forum menghasilkan hari serta bulan/tahun pada nomor forum; tanggal keputusan khusus menghasilkan bulan/tahun keputusan terkait. Nominal iuran yang jelas dapat menghasilkan terbilangnya.
4. Gunakan **Isi otomatis yang kosong** untuk mengambil data tersedia ke kolom yang masih kosong. Isian manual yang sudah berisi tidak ditimpa.
5. Buka **?** untuk kolom yang masih membutuhkan keputusan Anda. Tombol pilihan mengisi kolom hanya ketika diklik; rincian masih dapat diedit. Pada pilihan jamak, pilihan baru ditambahkan.
6. Klik **Simpan isian**, lalu **Pratinjau** untuk memeriksa Word/PDF. Isian otomatis yang mengikuti tanggal/nominal tetap dapat dihitung ulang setelah muat ulang. Isian yang sengaja diedit atau dikosongkan dipertahankan.

Angka iuran untuk terbilang ditulis sebagai nominal, misalnya `Rp50.000` atau `50000`. Uraian campuran seperti `Rp50.000 per peserta` tidak ditebak menjadi angka. Nomor, tanggal kejadian, pihak penandatangan, kuorum, dan dasar kewenangan yang belum mempunyai sumber tetap memerlukan pengisian.

Identitas organisasi induk dibedakan dari unit sanggar. Rekening badan hanya diambil jika pemilik, nama badan, konteks kolom, dan bentuk badan cocok. Mengganti nama badan tidak menarik rekening profil badan lama.

## Cakupan

Bantuan mencakup 372 kode isian pada 202 dokumen dalam 14 kelompok. Nama peserta, pelatih, pengurus, dan baris tabel memiliki petunjuk sesuai posisi masing-masing. Panel bantuan muncul di bawah kolom dan dapat digunakan melalui keyboard maupun ponsel.

Mode demo menyimpan isian di browser dan langsung memberi status tersimpan. Akun yang terhubung server tetap menunggu konfirmasi sinkronisasi server. Pengujian lokal tidak menggantikan pemeriksaan kebenaran dokumen sumber organisasi.

## Verifikasi lokal 20 September 2026

Sebanyak 395 tes logika/regresi dan 11 tes rute lulus; satu tes integrasi MariaDB dilewati pada mode cepat. TypeScript seluruh workspace dan build produksi lulus. Pemeriksaan browser mencakup perubahan tanggal setelah simpan/muat ulang, bantuan dan pilihan mandat, tampilan desktop/ponsel, serta unduhan Word dan PDF dengan isian mandat dua baris. Seluruh konversi template dan browser sembilan peran tidak dijalankan ulang untuk perubahan ini. Rincian tersimpan di `reports/verification-guided-forms-20260920.json`.

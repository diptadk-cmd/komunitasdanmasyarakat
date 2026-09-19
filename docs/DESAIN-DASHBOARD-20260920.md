# Ruang kerja JakSanggar

Beranda mendukung pekerjaan sembilan peran dalam komunitas seni Jakarta. Ilustrasi komunitas Betawi menjadi ciri visual bersama; data dan tindakan tetap menjadi isi utama.

## Token

| Peran warna | Nilai |
| --- | --- |
| Teks dan identitas navy | `#123047` |
| Tindakan jade | `#147D73` |
| Kanvas sejuk | `#F4F7FA` |
| Permukaan | `#FFFFFF` |
| Aksen emas kecil | `#D5A445` |
| Garis pemisah | `#DEE8EB` |

Gunakan font sans yang sudah dimuat aplikasi (Plus Jakarta Sans/Inter), judul 24–30 px, isi 14 px, keterangan minimal 12 px. Angka memakai tabular numerals. Mode gelap dan kontras tinggi mengikuti token tema.

## Susunan

```text
Sidebar       Judul + konteks pekerjaan    Ilustrasi budaya ringkas
              Tindakan utama + sekunder
              Ringkasan data dalam satu jalur
              Pekerjaan / akses cepat      Aktivitas atau panduan relevan
```

Isi rata kiri; ilustrasi tidak memuat teks, tidak menerima fokus, dan mengecil pada ponsel. Satu tindakan utama jelas pada setiap beranda. Data yang berkaitan memakai satu jalur statistik, bukan sekumpulan kartu dekoratif. Daftar pekerjaan memakai pemisah sederhana; kosongnya data diberi penjelasan dan langkah berikutnya.

## Tinjauan rancangan

Hero foto/gradien tinggi dan kartu angka yang berulang diganti ruang kerja padat yang khas komunitas seni. Beranda sanggar tetap mempertahankan sampul pribadi. Kurator tetap mempertahankan antrean dan grafik. Semua rute, izin, angka, dan data berasal dari aplikasi yang ada. Formulir Tools Dokumen tidak terkena selector baru.

Semua selector baru dibatasi pada `rw-*`/`role-workspace`, bukan elemen formulir global. Link dapat diakses keyboard, target sentuh minimum 44 px, susunan menjadi satu kolom di ponsel. Komponen presentasi tidak menambah fetch, efek, atau state turunan.

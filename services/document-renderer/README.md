# Document renderer

Layanan lokal pembuat Word dan PDF, dipulihkan dari renderer `jaksanggar-help-20260915`. Pemrosesan judul, penomoran, gambar, dan paket Word asli dipertahankan. Jalur native memakai DOCX katalog dan LibreOffice; Chromium hanya dimuat saat ada permintaan HTML.

## Menjalankan

Pasang dependensi workspace, lalu jalankan `pnpm --filter @workspace/document-renderer start`. Layanan mendengar di `127.0.0.1:3001` secara bawaan. LibreOffice diperlukan untuk PDF native. Pada Windows, lokasi standar `C:\Program Files\LibreOffice\program\soffice.com` ditemukan otomatis. Tidak memerlukan Python.

| Variabel                          | Nilai bawaan / kegunaan                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DOCUMENT_RENDERER_HOST`          | `127.0.0.1`; gunakan `0.0.0.0` secara eksplisit dalam container                                               |
| `DOCUMENT_RENDERER_PORT`          | `3001`; menerima `PORT` sebagai fallback                                                                      |
| `NATIVE_TEMPLATE_ROOT`            | `artifacts/jak-sanggar/public/dokumen-fix` pada repo ini, dihitung dari lokasi modul, bukan working directory |
| `LIBREOFFICE_PATH`                | Opsional: executable LibreOffice khusus                                                                       |
| `DOCUMENT_RENDERER_CHROMIUM_PATH` | Opsional: executable Chromium untuk jalur HTML                                                                |

Aset native terdiri atas `catalog.json` dan seluruh `templates/**/*.docx` yang dirujuknya (202 dokumen, 14 kelompok saat dipulihkan). Katalog tidak disalin agar frontend dan renderer memakai versi yang sama. Untuk pemasangan terpisah, salin seluruh direktori tersebut dan atur `NATIVE_TEMPLATE_ROOT`.

## Kontrak HTTP

`GET /healthz` mengembalikan `{service: "jaksanggar-document-renderer", ok, capabilities, nativeTemplates, libreOffice}`. Status 200 berarti semua aset native tersedia dan LibreOffice terdeteksi; 503 berarti ada prasyarat yang belum tersedia. Kesiapan HTML tidak diklaim oleh health check karena Chromium baru dibuka ketika dibutuhkan.

`POST /render` menerima JSON maksimal 8 MB:

```json
{
  "format": "pdf",
  "nativeTemplate": {
    "groupId": "mandiri-nonbadan-hukum",
    "documentId": "anggaran-dasar-sanggar",
    "values": { "NAM_SA2": "Sanggar Contoh" }
  }
}
```

`format` adalah `word` atau `pdf`. `nativeTemplate.images` opsional menerima `logo`, `stamp`, dan `letterhead` berupa PNG data URL (maksimal 1 MB per gambar). Word mempertahankan bagian asli paket, mengganti field yang diizinkan katalog, dan menjaga aturan struktur dokumen. PDF dikonversi memakai profil LibreOffice terpisah untuk setiap pekerjaan, termasuk path Windows yang mengandung spasi. Respons sukses berisi byte DOCX/PDF dengan Content-Type sesuai format; kesalahan berupa JSON `{error}`.

Jalur lama tetap menerima `{format, html, title?, pageMarginsMm?, footer?}`. Jalur ini memerlukan browser Playwright yang terpasang (`pnpm --filter @workspace/document-renderer exec playwright install chromium`). Request jaringan halaman HTML diblokir, JavaScript dokumen dinonaktifkan, dan gambar terbatas pada data URL. Server membatasi dua pekerjaan bersamaan. API utama tetap menjadi tempat autentikasi; layanan renderer lokal tidak menyediakan login sendiri.

## Verifikasi

`pnpm --filter @workspace/document-renderer test` menguji substitusi teks, penomoran/struktur katalog, gambar, bagian DOCX yang dipertahankan, validasi input, dan path Windows. `pnpm --filter @workspace/document-renderer test:pdf` menguji health native serta konversi PDF nyata menggunakan LibreOffice. Kedua perintah tidak menjalankan server HTTP atau Chromium. Tes HTML/browser terpisah dari cakupan native ini.

Dokumentasi parameter konversi: [LibreOffice command line](https://help.libreoffice.org/latest/en-GB/text/shared/guide/start_parameters.html). Jalur HTML mempertahankan pemakaian [TurboDocx HTML-to-DOCX](https://github.com/TurboDocx/html-to-docx).

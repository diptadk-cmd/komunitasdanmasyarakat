# Pasang Jak Sanggar di VPS Bizznet Neo Lite

Panduan lengkap untuk memasang aplikasi Jak Sanggar di server VPS Anda
sendiri menggunakan Nginx + HTTPS gratis dari Let's Encrypt.

Karena Jak Sanggar adalah aplikasi frontend murni (semua data tersimpan di
browser pengguna lewat localStorage), **tidak perlu** database, Node.js,
atau backend yang berjalan terus di server. Hanya butuh web server
sederhana untuk menyajikan file HTML/CSS/JS.

---

## Apa yang Anda butuhkan

1. **VPS Bizznet Neo Lite** dengan OS **Ubuntu 22.04 / 24.04** atau Debian 11/12.
2. **Akses SSH** ke VPS (biasanya `root@IP_VPS`).
3. **Domain** yang sudah Anda arahkan ke IP VPS (DNS A record).
4. Di **komputer Anda** (Linux/macOS/WSL), terpasang:
   - `ssh`
   - `rsync`
   - `pnpm` (untuk build) — `npm install -g pnpm`
   - `node` versi 20+

> Pengguna Windows: pakai **WSL** (Ubuntu di Windows) supaya `rsync` dan `ssh` jalan dengan baik.

---

## Langkah 1 — Siapkan akses SSH tanpa password (sekali saja)

Supaya skrip deploy tidak meminta password setiap kali:

```bash
# Buat SSH key di komputer Anda jika belum ada
ssh-keygen -t ed25519 -C "deploy@jak-sanggar"

# Salin kunci publik ke VPS
ssh-copy-id -p 22 root@IP_VPS_ANDA
```

Coba: `ssh root@IP_VPS_ANDA` — harus langsung masuk tanpa minta password.

---

## Langkah 2 — Isi konfigurasi `.env`

```bash
cd artifacts/jak-sanggar/deploy
cp .env.example .env
nano .env       # atau editor favorit Anda
```

Isi nilai berikut:

| Variabel              | Contoh                | Keterangan                                |
| --------------------- | --------------------- | ----------------------------------------- |
| `VPS_HOST`            | `103.150.10.20`       | IP atau hostname VPS                      |
| `VPS_USER`            | `root`                | User SSH                                  |
| `VPS_PORT`            | `22`                  | Port SSH (default 22)                     |
| `VPS_PATH`            | `/var/www/jak-sanggar`| Folder web di VPS                         |
| `DOMAIN`              | `jaksanggar.id`       | Domain utama (sudah arah ke IP VPS)       |
| `LETSENCRYPT_EMAIL`   | `admin@jaksanggar.id` | Email untuk pemberitahuan sertifikat HTTPS |

---

## Langkah 3 — Setup awal VPS (sekali saja)

Skrip ini akan: install Nginx + certbot + UFW firewall, buat folder web,
pasang konfigurasi situs, dan menerbitkan sertifikat HTTPS otomatis.

```bash
# Dari komputer Anda — kirim 3 file ke VPS
cd artifacts/jak-sanggar
scp deploy/setup-vps.sh deploy/nginx-jak-sanggar.conf deploy/.env \
    root@IP_VPS_ANDA:/root/

# Masuk ke VPS dan jalankan
ssh root@IP_VPS_ANDA
bash /root/setup-vps.sh
```

Tunggu sampai selesai. Kalau DNS domain Anda sudah benar arahnya ke IP VPS,
HTTPS akan otomatis aktif. Kalau belum, jalankan ulang nanti:

```bash
certbot --nginx -d DOMAIN_ANDA
```

Setelah ini, buka `http://DOMAIN_ANDA` — harus muncul halaman placeholder
"Jak Sanggar — VPS siap."

---

## Langkah 4 — Deploy aplikasi (rutin, setiap kali ada update)

Dari komputer Anda di folder repo:

```bash
cd artifacts/jak-sanggar
./deploy/deploy.sh
```

Skrip akan:

1. Build aplikasi (`pnpm build`) → `dist/public/`
2. Upload via `rsync` ke `VPS_PATH` di server (file lama yang tidak dipakai dihapus otomatis)
3. Set permission supaya Nginx bisa baca

Selesai. Refresh `https://DOMAIN_ANDA` di browser.

> Tips: deploy biasanya hanya butuh 1–2 menit. Aman dijalankan kapan saja
> tanpa downtime — file lama tergantikan instan begitu rsync selesai.

---

## Struktur file di folder `deploy/`

```
deploy/
├── README.md                 ← panduan ini
├── .env.example              ← template konfigurasi
├── .env                      ← (dibuat oleh Anda, jangan di-commit)
├── .gitignore                ← biar .env tidak masuk git
├── build.sh                  ← build saja (tanpa upload)
├── deploy.sh                 ← build + upload ke VPS  ★ paling sering dipakai
├── setup-vps.sh              ← jalankan di VPS, sekali saja
└── nginx-jak-sanggar.conf    ← template konfigurasi Nginx
```

---

## Catatan teknis

### Ukuran build

Aplikasi Jak Sanggar berukuran sekitar **2 MB** (sebelum gzip) atau
~600 KB ter-gzip. Ringan untuk VPS Neo Lite.

### Data pengguna

Semua data sanggar (anggota, kas, jadwal, dst.) disimpan di **localStorage
browser masing-masing user**, **bukan di server**. Konsekuensinya:

- Server VPS tidak menyimpan data apa pun → tidak butuh backup database.
- Setiap perangkat punya data sendiri. Jika user logout/ganti browser,
  data hilang dari sisi mereka. Ini sesuai desain awal aplikasi.
- Jika nantinya ingin sinkronisasi multi-perangkat, perlu menambah
  backend (mis. pakai `@workspace/api-server` di repo).

### Update otomatis sertifikat HTTPS

`certbot.timer` sudah aktif. Sertifikat akan diperpanjang otomatis ~30 hari
sebelum kadaluarsa. Cek statusnya:

```bash
ssh root@VPS systemctl status certbot.timer
ssh root@VPS certbot certificates
```

### Menambah domain kedua / `www.`

Edit `/etc/nginx/sites-available/jak-sanggar` di VPS, ubah baris
`server_name` jadi `server_name jaksanggar.id www.jaksanggar.id;` lalu:

```bash
nginx -t && systemctl reload nginx
certbot --nginx -d jaksanggar.id -d www.jaksanggar.id
```

### Rollback cepat

`rsync` kami pakai mode `--delete` (bersih-bersih). Kalau ingin bisa
rollback, sebelum deploy buat snapshot di VPS:

```bash
ssh root@VPS "cp -r /var/www/jak-sanggar /var/www/jak-sanggar.backup-$(date +%Y%m%d-%H%M)"
```

### Troubleshooting

| Gejala                                  | Periksa                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `Permission denied (publickey)`         | SSH key belum disalin → ulangi `ssh-copy-id`                            |
| Halaman 502 / 404                       | `ssh root@VPS tail -f /var/log/nginx/jak-sanggar.error.log`             |
| HTTPS gagal terbit                      | DNS domain belum mengarah ke IP VPS. Tunggu propagasi DNS lalu ulangi.  |
| Halaman lama muncul setelah deploy      | Hard refresh (Ctrl+Shift+R) atau cek cache browser                      |
| `rsync: command not found` (lokal)      | Pasang: `sudo apt install rsync` (Linux) / `brew install rsync` (macOS) |

---

Semoga lancar pemasangannya. Untuk pertanyaan teknis lain, cek log VPS
atau hubungi support Bizznet untuk hal yang menyangkut jaringan/firewall
sisi mereka.

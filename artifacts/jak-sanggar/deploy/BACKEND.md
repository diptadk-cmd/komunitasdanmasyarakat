# Backend Jak Sanggar di VPS Bizznet Neo Lite

Dokumen ini melanjutkan `README.md` (yang hanya untuk situs statis). Setelah
Tahap 1 selesai (DB schema, auth, users, uploads), berikut langkah pasang
backend di VPS. **Eksekusi nyata ditunda ke Tahap 6** — file ini cuma peta jalan
supaya jelas apa yang perlu kita siapkan nanti.

## Komponen yang akan dipasang

1. **MariaDB 10.11+** — sumber data utama (gantikan localStorage browser).
2. **MinIO** — penyimpanan berkas (foto profil, galeri, dokumen) S3-compatible.
3. **Node.js (API server)** — Express 5 + Drizzle ORM, dijalankan systemd.
4. **Nginx** — reverse-proxy `/api` → backend, sekaligus tetap melayani
   `dist/` situs statis Vite seperti sebelumnya.

---

## 1. Pasang MariaDB

```bash
sudo apt update
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb

# (opsional) amankan instalasi: set password root, buang akun anonim, dll.
sudo mariadb-secure-installation

# Buat database & user
sudo mariadb <<'SQL'
CREATE DATABASE jaksanggar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'jaksanggar'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON jaksanggar.* TO 'jaksanggar'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Koneksi memakai variabel `MARIADB_URL` (atau `DATABASE_URL` — keduanya dibaca,
`MARIADB_URL` diutamakan). Formatnya URL MySQL:

```
mysql://jaksanggar:GANTI_PASSWORD_KUAT@127.0.0.1:3306/jaksanggar
```

Push skema dari laptop dev (atau langsung di VPS jika repo ter-clone):

```bash
MARIADB_URL=mysql://jaksanggar:...@127.0.0.1:3306/jaksanggar \
  pnpm --filter @workspace/db run sync
```

Perintah `sync` memakai `drizzle-kit push` hanya untuk database baru. Untuk
database MariaDB yang sudah ada, migrasi kompatibilitas dijalankan langsung
agar tidak terkena bug introspeksi CHECK constraint pada `drizzle-kit push`.

> Catatan: kode menargetkan MariaDB/MySQL (driver `mysql2`, Drizzle dialect
> `mysql`). Jangan pakai PostgreSQL — schema & query sudah khusus MariaDB.

---

## 2. Pasang MinIO

```bash
sudo useradd -r minio-user -s /sbin/nologin
sudo mkdir -p /var/lib/minio /etc/minio
sudo chown -R minio-user:minio-user /var/lib/minio /etc/minio

wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
sudo chmod +x /usr/local/bin/minio
```

Buat `/etc/default/minio`:

```
MINIO_ROOT_USER=jaksanggar-admin
MINIO_ROOT_PASSWORD=GANTI_PASSWORD_KUAT_LAGI
MINIO_VOLUMES="/var/lib/minio"
MINIO_OPTS="--address :9000 --console-address :9001"
```

Buat unit systemd `/etc/systemd/system/minio.service`:

```ini
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
User=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now minio
```

Buka console MinIO di `http://VPS_IP:9001`, login pakai root user, lalu:

1. Buat bucket `jak-sanggar`.
2. Buat access key terbatas (mis. `jak-app`) dengan policy
   `readwrite` ke bucket `jak-sanggar`. Catat access key + secret.

> Sebaiknya MinIO **tidak** terekspos langsung — biarkan Nginx yang reverse-proxy
> ke port 9000 di balik domain misal `storage.jaksanggar.example.com` (TLS
> via Let's Encrypt) atau cukup dipakai internal saja.

---

## 3. Jalankan API server (Node)

Di repo (anggap `~/jak-sanggar`):

```bash
pnpm install --prod=false
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run build
```

Buat `/etc/jaksanggar-api.env`:

```
NODE_ENV=production
PORT=8080
MARIADB_URL=mysql://jaksanggar:...@127.0.0.1:3306/jaksanggar
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=jak-sanggar
S3_ACCESS_KEY=jak-app
S3_SECRET_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=otp@example.com
SMTP_PASS=GANTI_DENGAN_APP_PASSWORD
EMAIL_FROM=otp@example.com
EMAIL_FROM_NAME=JAK SANGGAR
PASSWORD_RESET_DEV_EXPOSE_OTP=false
```

Untuk Google Workspace gunakan App Password atau OAuth2; jangan isi
`SMTP_PASS` dengan password akun utama. Port 587 memakai STARTTLS
(`SMTP_SECURE=false`), sedangkan port 465 memakai TLS langsung
(`SMTP_SECURE=true`). Jangan pernah mengaktifkan
`PASSWORD_RESET_DEV_EXPOSE_OTP` pada server publik.

Buat `/etc/systemd/system/jaksanggar-api.service`:

```ini
[Unit]
Description=Jak Sanggar API Server
After=network.target mariadb.service minio.service

[Service]
WorkingDirectory=/home/deploy/jak-sanggar/artifacts/api-server
EnvironmentFile=/etc/jaksanggar-api.env
ExecStart=/usr/bin/node --enable-source-maps ./dist/index.mjs
Restart=always
User=deploy

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jaksanggar-api
sudo systemctl status jaksanggar-api --no-pager
```

Test:

```bash
curl http://127.0.0.1:8080/api/healthz
```

---

## 4. Update Nginx

Tambahkan blok `location /api/` di server block site yang sudah ada
(`nginx-jak-sanggar.conf`):

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Untuk upload berkas (multipart) — ijinkan body besar
    client_max_body_size 12M;

    # Streaming respons (mis. /api/uploads/:id/raw)
    proxy_buffering off;
}
```

Reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Verifikasi

```bash
curl https://jaksanggar.example.com/api/healthz
# {"status":"ok"}
```

Pastikan saat di production:

- `NODE_ENV=production` aktif → cookie `Secure` (hanya HTTPS) **dan seed akun
  demo otomatis dilewati** (server tidak membuat akun default apapun).
- Domain situs & domain API **sama** (sub-path `/api`) supaya cookie sesi
  terkirim otomatis.

Untuk memverifikasi login, buat akun kurator produksi terlebih dahulu (lihat
langkah "Buat akun kurator awal" di bawah), lalu uji dengan kredensial yang
Anda buat sendiri — **jangan gunakan kredensial demo bawaan**.

---

## Buat akun kurator awal (wajib di production)

Karena `NODE_ENV=production` menonaktifkan seed otomatis, buat akun kurator
secara manual sebelum server pertama kali menerima traffic publik:

```bash
# Jalankan sekali dari direktori repo (NODE_ENV harus production)
NODE_ENV=production MARIADB_URL=mysql://jaksanggar:...@127.0.0.1:3306/jaksanggar \
  node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection(process.env.MARIADB_URL);
  const hash = await bcrypt.hash('GANTI_PASSWORD_KURATOR_KUAT', 10);
  await conn.execute(
    \"INSERT INTO users (id, username, password_hash, role, status) VALUES (UUID(), ?, ?, 'kurator', 'aktif')\",
    ['nama_kurator_anda', hash]
  );
  await conn.end();
  console.log('Akun kurator berhasil dibuat.');
})();
"
```

Ganti `nama_kurator_anda` dan `GANTI_PASSWORD_KURATOR_KUAT` dengan nilai yang
aman dan unik. Simpan kredensial ini di tempat yang aman (password manager).

---

## Catatan keamanan

- **Akun demo tidak dibuat di production** — seed otomatis hanya berjalan saat
  `NODE_ENV !== "production"`. Tidak ada akun default dengan password bawaan.
- Buat akun kurator produksi secara manual (lihat langkah di atas) dengan
  password kuat yang unik sebelum server menerima traffic publik.
- Aktifkan firewall (`ufw allow 22, 80, 443; deny 3306, 9000, 9001`) supaya
  MariaDB & MinIO tidak terekspos.
- Backup berkala: `mariadb-dump jaksanggar` (atau `mysqldump`) untuk MariaDB,
  `mc mirror` (MinIO client) untuk bucket.
- Sesi pengguna otomatis dicabut seluruhnya saat password diganti atau akun
  dinonaktifkan — tidak ada sesi lama yang tetap valid setelah tindakan
  penonaktifan atau reset sandi.

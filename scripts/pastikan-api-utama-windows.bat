@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not defined API_PORT set "API_PORT=3000"

rem Nilai dari launcher harus menang atas nilai bawaan di .env.
set "LAUNCH_SEED_DEMO_USERS=%SEED_DEMO_USERS%"
set "LAUNCH_SEED_DEMO_CONTENT=%SEED_DEMO_CONTENT%"

rem Muat konfigurasi API agar proses baru memakai database yang sama.
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)
if not defined MARIADB_URL if defined DATABASE_URL set "MARIADB_URL=%DATABASE_URL%"
if not defined MARIADB_URL set "MARIADB_URL=mysql://root@127.0.0.1:3306/jaksanggar"
if defined LAUNCH_SEED_DEMO_USERS set "SEED_DEMO_USERS=%LAUNCH_SEED_DEMO_USERS%"
if defined LAUNCH_SEED_DEMO_CONTENT set "SEED_DEMO_CONTENT=%LAUNCH_SEED_DEMO_CONTENT%"
if not defined DOCUMENT_RENDERER_URL set "DOCUMENT_RENDERER_URL=http://127.0.0.1:3001/render"

echo Memastikan generator Word/PDF lokal siap...
node scripts/start-document-renderer.mjs --api
if errorlevel 1 exit /b 1

if /i "%SEED_DEMO_USERS%"=="true" (
  echo Memastikan akun demo tersedia di MariaDB...
  call corepack pnpm --filter @workspace/db run sync
  if errorlevel 1 (
    echo [GAGAL] Struktur MariaDB tidak dapat disinkronkan.
    exit /b 1
  )
  call corepack pnpm --filter @workspace/api-server run seed:demo-users
  if errorlevel 1 (
    echo [GAGAL] Akun demo tidak dapat disiapkan di MariaDB.
    exit /b 1
  )
)

call :api_sehat
if not errorlevel 1 (
  echo API utama sudah sehat di port %API_PORT%.
  exit /b 0
)

set "PORT_BUSY="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%API_PORT% .*LISTENING"') do set "PORT_BUSY=1"
if defined PORT_BUSY (
  echo [GAGAL] Port %API_PORT% dipakai proses lain, tetapi bukan API Jak Sanggar yang sehat.
  echo Tutup proses pada port tersebut lalu jalankan kembali.
  exit /b 1
)

set "DB_READY="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3306 .*LISTENING"') do set "DB_READY=1"
if not defined DB_READY (
  echo [PERINGATAN] MariaDB lokal belum terdeteksi pada port 3306.
  echo Jika MARIADB_URL menunjuk server database lain, peringatan ini dapat diabaikan.
)

echo Menjalankan API utama dan sinkronisasi database...
start "JAK SANGGAR - API Utama :%API_PORT%" /D "%CD%" cmd /k "set NODE_ENV=development&& set PORT=%API_PORT%&& call corepack pnpm --filter @workspace/db run sync&& call corepack pnpm --filter @workspace/api-server run build&& call corepack pnpm --filter @workspace/api-server start"

echo Menunggu API siap menerima login...
set /a WAIT_COUNT=0
:tunggu_api
call :api_sehat
if not errorlevel 1 (
  echo API siap: http://localhost:%API_PORT%/api/healthz
  exit /b 0
)
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ 90 goto api_gagal
timeout /t 1 /nobreak >nul
goto tunggu_api

:api_gagal
echo [GAGAL] API belum sehat setelah 90 detik.
echo Lihat pesan pada jendela "JAK SANGGAR - API Utama" untuk penyebabnya.
exit /b 1

:api_sehat
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%API_PORT%/api/healthz' -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match '\"status\"\s*:\s*\"ok\"') { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

@echo off
chcp 65001 >nul
setlocal EnableExtensions
for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

set "MODE=%~1"
if not defined MODE (
  echo [GAGAL] Mode launcher belum diberikan.
  exit /b 1
)

call :persiapan
if errorlevel 1 exit /b 1

if /i "%MODE%"=="demo-api" goto mode_demo_api
if /i "%MODE%"=="demo-lokal" goto mode_demo_lokal
if /i "%MODE%"=="non-demo" goto mode_non_demo
if /i "%MODE%"=="kurator" goto mode_kurator

echo [GAGAL] Mode "%MODE%" tidak dikenal.
exit /b 1

:mode_demo_api
title JAK SANGGAR - Demo API dan MariaDB :5175
set "API_PORT=3000"
set "APP_PORT=5175"
set "DEMO_SESSION_PER_TAB=true"
set "SEED_DEMO_USERS=true"
set "SEED_DEMO_CONTENT=true"
echo Menyiapkan API, MariaDB, dan akun demo...
call "%PROJECT_ROOT%\scripts\pastikan-api-utama-windows.bat"
if errorlevel 1 goto gagal
call :mulai_aplikasi "%APP_PORT%" "false" "true" "http://localhost:5174/konsol/" "JAK SANGGAR - Demo API MariaDB :%APP_PORT%"
call :tunggu_port "%APP_PORT%" 60
if errorlevel 1 (
  echo [GAGAL] Aplikasi demo API belum siap di port %APP_PORT%.
  goto gagal
)
start "" "http://localhost:%APP_PORT%/"
echo.
echo Demo API + MariaDB : http://localhost:%APP_PORT%/
echo API                : http://localhost:%API_PORT%/api/healthz
echo Tombol akun demo tersedia pada halaman login.
goto selesai

:mode_demo_lokal
title JAK SANGGAR - Demo Lokal :5180
node scripts/start-document-renderer.mjs
if errorlevel 1 goto gagal
set "APP_PORT=5180"
set "KONSOL_PORT=5181"
set "DEMO_SESSION_PER_TAB=true"
call :mulai_aplikasi "%APP_PORT%" "true" "true" "/konsol/" "JAK SANGGAR - Demo Lokal :%APP_PORT%" "%KONSOL_PORT%"
call :mulai_konsol "%KONSOL_PORT%" "true" "true" "http://localhost:%APP_PORT%/" "JAK SANGGAR - Kurator Demo Lokal :%KONSOL_PORT%"
call :tunggu_port "%APP_PORT%" 60
if errorlevel 1 (
  echo [GAGAL] Aplikasi demo lokal belum siap di port %APP_PORT%.
  goto gagal
)
call :tunggu_port "%KONSOL_PORT%" 60
if errorlevel 1 (
  echo [GAGAL] Konsol Kurator demo belum siap di port %KONSOL_PORT%.
  goto gagal
)
start "" "http://localhost:%APP_PORT%/"
start "" "http://localhost:%APP_PORT%/konsol/"
echo.
echo Demo lokal          : http://localhost:%APP_PORT%/
echo Kurator demo lokal  : http://localhost:%APP_PORT%/konsol/
echo Data disimpan di browser; API dan MariaDB tidak digunakan.
echo Tombol akun demo tersedia pada kedua halaman login.
goto selesai

:mode_non_demo
title JAK SANGGAR - Non-Demo API dan MariaDB :5173
set "API_PORT=3000"
set "APP_PORT=5173"
set "DEMO_SESSION_PER_TAB=false"
set "SEED_DEMO_USERS=false"
set "SEED_DEMO_CONTENT=false"
call "%PROJECT_ROOT%\scripts\pastikan-api-utama-windows.bat"
if errorlevel 1 goto gagal
call :mulai_aplikasi "%APP_PORT%" "false" "false" "http://localhost:5174/konsol/" "JAK SANGGAR - Aplikasi Non-Demo :%APP_PORT%"
call :tunggu_port "%APP_PORT%" 60
if errorlevel 1 (
  echo [GAGAL] Aplikasi non-demo belum siap di port %APP_PORT%.
  goto gagal
)
start "" "http://localhost:%APP_PORT%/"
echo.
echo Aplikasi non-demo : http://localhost:%APP_PORT%/
echo API               : http://localhost:%API_PORT%/api/healthz
echo Tombol akun demo disembunyikan.
goto selesai

:mode_kurator
title JAK SANGGAR - Kurator API dan MariaDB :5174
set "API_PORT=3000"
set "APP_PORT=5173"
set "KONSOL_PORT=5174"
set "SEED_DEMO_USERS=false"
set "SEED_DEMO_CONTENT=false"
call "%PROJECT_ROOT%\scripts\pastikan-api-utama-windows.bat"
if errorlevel 1 goto gagal
call :mulai_konsol "%KONSOL_PORT%" "false" "false" "http://localhost:%APP_PORT%/" "JAK SANGGAR - Kurator API MariaDB :%KONSOL_PORT%"
call :tunggu_port "%KONSOL_PORT%" 60
if errorlevel 1 (
  echo [GAGAL] Konsol Kurator belum siap di port %KONSOL_PORT%.
  goto gagal
)
start "" "http://localhost:%KONSOL_PORT%/konsol/"
echo.
echo Konsol Kurator : http://localhost:%KONSOL_PORT%/konsol/
echo API            : http://localhost:%API_PORT%/api/healthz
goto selesai

:persiapan
where node >nul 2>&1 || (
  echo [GAGAL] Node.js belum terpasang. Pasang Node.js 22 LTS.
  pause
  exit /b 1
)
where corepack >nul 2>&1 || (
  echo [GAGAL] Corepack tidak ditemukan. Perbarui Node.js 22 LTS.
  pause
  exit /b 1
)
call corepack enable >nul 2>&1
if not exist "node_modules\.pnpm" (
  echo Memasang dependensi untuk pertama kali...
  call corepack pnpm install --frozen-lockfile
  if errorlevel 1 call corepack pnpm install
  if errorlevel 1 (
    echo [GAGAL] Dependensi tidak dapat dipasang.
    pause
    exit /b 1
  )
)
exit /b 0

:mulai_aplikasi
setlocal
set "TARGET_PORT=%~1"
call :port_aktif "%TARGET_PORT%"
if not errorlevel 1 (
  echo Aplikasi sudah berjalan di port %TARGET_PORT%.
  endlocal & exit /b 0
)
echo Menjalankan aplikasi di port %TARGET_PORT%...
start "%~5" /D "%PROJECT_ROOT%" cmd /k "set NODE_ENV=development&& set VITE_DEMO_MODE=%~2&& set VITE_SHOW_DEMO_ACCOUNTS=%~3&& set VITE_DEMO_SESSION_PER_TAB=%DEMO_SESSION_PER_TAB%&& set VITE_CONSOLE_URL=%~4&& set API_PROXY_TARGET=http://127.0.0.1:3000&& set DEMO_CONSOLE_PROXY_TARGET=http://127.0.0.1:%~6&& set PORT=%TARGET_PORT%&& set BASE_PATH=/&& call corepack pnpm --filter @workspace/jak-sanggar run dev"
endlocal & exit /b 0

:mulai_konsol
setlocal
set "TARGET_PORT=%~1"
call :port_aktif "%TARGET_PORT%"
if not errorlevel 1 (
  echo Konsol Kurator sudah berjalan di port %TARGET_PORT%.
  endlocal & exit /b 0
)
echo Menjalankan Konsol Kurator di port %TARGET_PORT%...
start "%~5" /D "%PROJECT_ROOT%" cmd /k "set NODE_ENV=development&& set VITE_DEMO_MODE=%~2&& set VITE_SHOW_DEMO_ACCOUNTS=%~3&& set VITE_MAIN_APP_URL=%~4&& set API_PROXY_TARGET=http://127.0.0.1:3000&& set PORT=%TARGET_PORT%&& set BASE_PATH=/konsol/&& call corepack pnpm --filter @workspace/konsol run dev"
endlocal & exit /b 0

:port_aktif
set "PORT_READY="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do set "PORT_READY=1"
if defined PORT_READY exit /b 0
exit /b 1

:tunggu_port
set /a WAIT_COUNT=0
:tunggu_port_loop
call :port_aktif "%~1"
if not errorlevel 1 exit /b 0
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ %~2 exit /b 1
timeout /t 1 /nobreak >nul
goto tunggu_port_loop

:gagal
echo.
echo Periksa pesan kesalahan pada jendela layanan yang terbuka.
pause
exit /b 1

:selesai
echo.
echo Tutup jendela layanan untuk menghentikan prosesnya.
pause
exit /b 0

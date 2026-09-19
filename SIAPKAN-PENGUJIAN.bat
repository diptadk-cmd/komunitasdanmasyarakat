@echo off
cd /d "%~dp0"
call corepack pnpm install --frozen-lockfile
if errorlevel 1 exit /b %errorlevel%
call corepack pnpm exec playwright install chromium
if errorlevel 1 exit /b %errorlevel%
echo Siap. Jalankan UJI-SEMUA-FITUR.bat.
pause

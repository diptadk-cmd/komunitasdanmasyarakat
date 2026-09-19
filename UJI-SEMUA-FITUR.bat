@echo off
cd /d "%~dp0"
echo Menjalankan tes JakSanggar. Laporan disimpan di output\test-reports.
call corepack pnpm run test:all
set "testResult=%errorlevel%"
echo.
echo Kode hasil: %testResult%  ^(0 berarti semua pemeriksaan yang dijalankan lulus^)
echo Buka output\test-reports\index.html untuk hasil lengkap.
pause
exit /b %testResult%

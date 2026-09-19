@echo off
cd /d "%~dp0"
node scripts/start-document-renderer.mjs
if errorlevel 1 pause

@echo off
rem MoneyInMotion: start the website and API on Windows.
rem
rem   run.bat        production server (default; installs and builds when needed)
rem   run.bat dev    API and Vite website with hot reload
rem
rem All logic lives in scripts\run.mjs, shared with ./run.sh.

setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [error] Node.js 24 or newer is required: https://nodejs.org/
  exit /b 1
)

node scripts\run.mjs %*
exit /b %errorlevel%

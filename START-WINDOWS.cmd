@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not on PATH.
  echo Install Node.js 22.13 or newer, then reopen this file.
  pause
  exit /b 1
)
node scripts\start-local.mjs
if errorlevel 1 (
  echo.
  echo LYCA could not start. Read the message above.
  pause
  exit /b 1
)

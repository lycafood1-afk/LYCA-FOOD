@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 22.12 or newer from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\lenis" (
  echo Installing required packages...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Check your internet connection, then try again.
    pause
    exit /b 1
  )
)
echo Starting LYCA website at http://localhost:8443/
call npm run dev
pause

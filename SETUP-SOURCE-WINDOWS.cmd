@echo off
setlocal
cd /d "%~dp0"
node scripts\setup-source.mjs %*
if errorlevel 1 (
  echo Source dependency setup failed. Read the message above.
  pause
  exit /b 1
)
echo Source dependencies installed successfully.
pause

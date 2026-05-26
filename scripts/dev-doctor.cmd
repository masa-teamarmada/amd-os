@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS1_FILE=%SCRIPT_DIR%dev-doctor.ps1"

if not exist "%PS1_FILE%" (
  echo fail %PS1_FILE% not found
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_FILE%"
exit /b %ERRORLEVEL%

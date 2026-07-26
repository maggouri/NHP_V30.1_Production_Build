@echo off
setlocal EnableExtensions
title NHP - Register Native Messaging

REM addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.cmd
set "REG_DIR=%~dp0"
if "%REG_DIR:~-1%"=="\" set "REG_DIR=%REG_DIR:~0,-1%"
for %%I in ("%REG_DIR%\..") do set "ADDON_DIR=%%~fI"
for %%I in ("%ADDON_DIR%\..") do set "NHP_ROOT=%%~fI"

set "DEFAULT_EXT_ID=bhhahkcjolghbigcognobplmgdbkmekb"
set "EXT_ID=%~1"
if "%EXT_ID%"=="" set "EXT_ID=%DEFAULT_EXT_ID%"

echo ==========================================
echo   NHP Native Messaging Registration
echo   (HKCU - once per PC)
echo ==========================================
echo Project Root: %NHP_ROOT%
echo Extension ID: %EXT_ID%
echo.

call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org/
  echo Then double-click this file again.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js still not found after PATH fix.
  echo Install Node.js LTS from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\Setup_Native_Messaging.ps1" (
  echo [ERROR] Missing Setup_Native_Messaging.ps1
  echo Expected at: %NHP_ROOT%\Setup_Native_Messaging.ps1
  echo.
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\native-host\nhp_native_host.js" (
  echo [ERROR] Missing native-host\nhp_native_host.js under project root.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\Setup_Native_Messaging.ps1" -ProjectDir "%NHP_ROOT%" -ExtensionId "%EXT_ID%"
if errorlevel 1 (
  echo.
  echo [ERROR] Native Messaging registration failed.
  echo.
  echo If auto-detect fails, pass your extension ID from chrome://extensions:
  echo   %~nx0 YOUR_EXTENSION_ID
  echo.
  echo Packaged default ID: %DEFAULT_EXT_ID%
  echo.
  pause
  exit /b 1
)

REM Ensure host path matches this App Root (portable after folder moves).
if exist "%NHP_ROOT%\utils\nhp-repair-native-host-path.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\utils\nhp-repair-native-host-path.ps1" -ProjectDir "%NHP_ROOT%"
)

echo.
echo [SUCCESS] Native Messaging registered successfully.
echo.
echo Next steps:
echo   1. Reload the extension from chrome://extensions
echo   2. Use Admin panel server start/stop buttons
echo.
pause
exit /b 0

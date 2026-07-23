@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Start All Servers
REM Run from project folder (double-click). For download copy, use Admin panel .bat download.

call :EnsureNodePath
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install from https://nodejs.org/ then run this file again.
  echo.
  pause
  exit /b 1
)

set "NHP_ROOT=%~dp0"
if "%NHP_ROOT:~-1%"=="\" set "NHP_ROOT=%NHP_ROOT:~0,-1%"

if not exist "%NHP_ROOT%\package.json" (
  echo ERROR: package.json not found in "%NHP_ROOT%"
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\server_logs" mkdir "%NHP_ROOT%\server_logs"

echo.
echo ========================================
echo   NHP - Starting servers (hidden)
echo ========================================
echo Project: %NHP_ROOT%
echo.

echo [1/6] TeePublic Ghost (3019)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Start_Ghost_On_Port.ps1" -Port 3019
echo [2/6] Creaty Signup (3020)...
call "%NHP_ROOT%\Start_Creaty_Server_Background.cmd"
echo [3/6] Redbubble Ghost (3021)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Start_Ghost_On_Port.ps1" -Port 3021
echo [4/6] Amazon Ghost (3022)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Start_Ghost_On_Port.ps1" -Port 3022
echo [5/6] Pinterest Ghost (3023)...
call "%NHP_ROOT%\Start_Pinterest_Server_Background.cmd"
echo [6/6] AI Bridge (3031)...
call "%NHP_ROOT%\Start_AI_Bridge_Server_Background.cmd"

echo.
echo ========================================
echo   Server status
echo ========================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1" -WaitForAll -MaxWaitSeconds 90
echo.
echo Logs: %NHP_ROOT%\server_logs\
echo.
echo Press any key to close this window...
pause >nul
endlocal
exit /b 0

:EnsureNodePath
where node >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
  exit /b 0
)
if exist "%LocalAppData%\Programs\node\node.exe" (
  set "PATH=%LocalAppData%\Programs\node;%PATH%"
  exit /b 0
)
exit /b 1


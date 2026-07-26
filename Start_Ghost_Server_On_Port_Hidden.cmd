@echo off
setlocal EnableExtensions
REM Start ghost-server.js on port %1 with no visible console (used by NHP_Start_All_Servers.cmd).
cd /d "%~dp0"

set "GHOST_PORT=%~1"
if "%GHOST_PORT%"=="" set "GHOST_PORT=3019"

call "%~dp0NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 (
    echo ERROR: Node.js is not in PATH.
    exit /b 1
)

if not exist "package.json" (
    echo ERROR: package.json not found in "%CD%"
    exit /b 1
)

if not exist "server_logs" mkdir "server_logs"

if /i not "%~2"=="force" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:%GHOST_PORT%/ping' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
    if not errorlevel 1 exit /b 0
)

set "NHP_DIR=%~dp0"
if "%NHP_DIR:~-1%"=="\" set "NHP_DIR=%NHP_DIR:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:NHP_GHOST_PORT='%GHOST_PORT%'; $env:NHP_ROOT_DIR='%NHP_DIR%'; $dir='%NHP_DIR%'; Start-Process -FilePath 'node.exe' -ArgumentList 'ghost-server.js' -WorkingDirectory $dir -WindowStyle Hidden -RedirectStandardOutput ($dir + '\server_logs\ghost-%GHOST_PORT%.out.log') -RedirectStandardError ($dir + '\server_logs\ghost-%GHOST_PORT%.err.log')"
exit /b 0

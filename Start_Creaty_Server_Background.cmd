@echo off
setlocal EnableExtensions
REM Start creaty-server.js on port 3020 (hidden). Used by NHP_Start_All_Servers and AUT panel.
cd /d "%~dp0"

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

if /i not "%~1"=="force" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3020/ping' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
    if not errorlevel 1 exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start_Creaty_Server_Background.ps1"
exit /b %ERRORLEVEL%

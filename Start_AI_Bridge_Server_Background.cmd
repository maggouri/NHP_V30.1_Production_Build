@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call "%~dp0NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 exit /b 1
set "NHP_DIR=%~dp0"
if "%NHP_DIR:~-1%"=="\" set "NHP_DIR=%NHP_DIR:~0,-1%"
if not exist "server_logs" mkdir "server_logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3031/ping' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 exit /b 0
powershell -NoProfile -ExecutionPolicy Bypass -Command "$dir='%NHP_DIR%'; Start-Process -FilePath 'node.exe' -ArgumentList 'ai-bridge-server.js' -WorkingDirectory $dir -WindowStyle Hidden -RedirectStandardOutput ($dir + '\server_logs\ai-bridge-server.out.log') -RedirectStandardError ($dir + '\server_logs\ai-bridge-server.err.log')"
endlocal

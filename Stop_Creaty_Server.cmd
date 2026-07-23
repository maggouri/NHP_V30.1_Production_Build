@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo         Stop Creaty Server (3020)
echo ========================================
echo.

powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3020/stop' -Method POST -TimeoutSec 3 | Out-Null } catch {}" >nul 2>&1

set "KILLED=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":3020" ^| findstr LISTENING') do (
    echo    Killing PID %%P
    taskkill /F /PID %%P >nul 2>&1
    if not errorlevel 1 set "KILLED=1"
)

if "%KILLED%"=="1" (
    echo [SUCCESS] Port 3020 cleared.
) else (
    echo [INFO] Creaty Server was not running.
)

echo.
exit /b 0

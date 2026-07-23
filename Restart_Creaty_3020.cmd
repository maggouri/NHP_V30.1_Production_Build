@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "server_logs" mkdir "server_logs"
set "RESTART_LOG=server_logs\restart-creaty.log"
>> "%RESTART_LOG%" echo ======== Restart_Creaty_3020 %date% %time% ========

echo ========================================
echo    إعادة تشغيل Creaty Server (3020)
echo ========================================
echo.

echo [1/3] إيقاف Creaty Server...
if exist "Stop_Creaty_Server.cmd" (
    call "Stop_Creaty_Server.cmd"
) else (
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":3020" ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
)

echo.
echo [2/3] انتظار 2 ثانية...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] تشغيل Creaty Server...
if exist "Start_Creaty_Server_Background.cmd" (
    call "Start_Creaty_Server_Background.cmd" force
) else (
    start "" /MIN cmd /c "set NHP_CREATY_PORT=3020 && node creaty-server.js 1>>server_logs\creaty-3020.out.log 2>>server_logs\creaty-3020.err.log"
)

timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3020/ping' -TimeoutSec 3; if ($r.ok) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel%==0 (
    echo.
    echo ✅ Creaty Server يعمل على المنفذ 3020
    >> "%RESTART_LOG%" echo SUCCESS: Creaty on port 3020
    timeout /t 2 /nobreak >nul
    exit /b 0
)

echo.
echo ❌ Creaty Server لم يرد على /ping — راجع server_logs\creaty-3020.*.log
>> "%RESTART_LOG%" echo FAIL: /ping failed
timeout /t 5 /nobreak
exit /b 1

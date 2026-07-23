@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions
cd /d "%~dp0"

REM Chrome extension root: never create files starting with _ (except _locales)
if not exist "server_logs" mkdir "server_logs"
set "RESTART_LOG=server_logs\restart-ghost.log"
call :nhp_log "======== Restart_Ghost_3019 %date% %time% ========"

echo ========================================
echo    إعادة تشغيل Ghost Server (3019)
echo ========================================
echo.

set "NODE_EXE="
where node >nul 2>nul
if not errorlevel 1 set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
if not defined NODE_EXE (
    echo ❌ خطأ: Node.js غير موجود في PATH — ثبّته من https://nodejs.org/
    call :nhp_log "ERROR: Node.js not found"
    goto :fail
)
if /i not "%NODE_EXE%"=="node" (
    for %%I in ("%NODE_EXE%") do set "PATH=%%~dpI;%PATH%"
)

if not exist "package.json" (
    echo ❌ خطأ: package.json غير موجود في "%CD%"
    call :nhp_log "ERROR: package.json missing"
    goto :fail
)

echo [1/4] إيقاف العملية على المنفذ 3019...
call :nhp_log "[1/4] Stop port 3019"
set "KILLED=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":3019" ^| findstr LISTENING') do (
    echo    إنهاء PID %%P
    call :nhp_log "   kill PID %%P"
    taskkill /F /PID %%P >nul 2>&1
    if not errorlevel 1 set "KILLED=1"
)

powershell -NoProfile -Command "`$port=3019; Get-CimInstance Win32_Process | Where-Object Name -eq 'node.exe' | Where-Object CommandLine -match 'ghost-server\.js' | ForEach-Object { try { `$c = Get-NetTCPConnection -LocalPort `$port -State Listen -OwningProcess `$_.ProcessId -ErrorAction SilentlyContinue; if (`$c) { Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output ('   إنهاء ghost PID {0}' -f `$_.ProcessId) } } catch {} }" 2>nul

if "%KILLED%"=="0" (
    echo    لا توجد عملية على المنفذ 3019 — سيتم التشغيل مباشرة.
)

echo.
echo [2/4] انتظار 2 ثانية...
timeout /t 2 /nobreak >nul

echo.
echo [3/4] تشغيل Ghost Server في الخلفية...
call :nhp_log "[3/4] Start ghost hidden"

if exist "Start_Ghost_Server_On_Port_Hidden.cmd" (
    call "Start_Ghost_Server_On_Port_Hidden.cmd" 3019 force
    set "RC=%ERRORLEVEL%"
) else if exist "Start_Ghost_Server_On_Port.cmd" (
    call "Start_Ghost_Server_On_Port.cmd" 3019 hidden
    set "RC=%ERRORLEVEL%"
) else (
    if not exist "server_logs" mkdir "server_logs"
    set "NHP_GHOST_PORT=3019"
    start "" /MIN cmd /c ""%NODE_EXE%" ghost-server.js 1>>"server_logs\ghost-3019.out.log" 2>>"server_logs\ghost-3019.err.log""
    set "RC=0"
)

if not "%RC%"=="0" (
    echo.
    echo ❌ فشل تشغيل Ghost Server (كود %RC%)
    call :nhp_log "ERROR: start failed RC=%RC%"
    goto :fail
)

echo.
echo [4/4] التحقق من http://127.0.0.1:3019/ping ...
timeout /t 2 /nobreak >nul

set "PING_OK=0"
call :check_ping
if "%PING_OK%"=="1" goto :success

timeout /t 1 /nobreak >nul
call :check_ping
if "%PING_OK%"=="1" goto :success

echo.
echo ❌ Ghost Server لم يرد على /ping — راجع server_logs\ghost-3019.*.log
call :nhp_log "ERROR: /ping failed — see ghost-3019 logs"
goto :fail

:check_ping
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3019/ping' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 set "PING_OK=1"
exit /b 0

:success
echo.
echo ✅ Ghost Server يعمل على المنفذ 3019
call :nhp_log "SUCCESS: Ghost on port 3019"
timeout /t 2 /nobreak >nul
exit /b 0

:fail
echo.
echo ❌ فشل إعادة التشغيل — راجع الرسائل أعلاه أو server_logs\ghost-3019.*.log و %RESTART_LOG%
call :nhp_log "FAIL: restart aborted"
echo.
timeout /t 8 /nobreak
exit /b 1

:nhp_log
if not defined RESTART_LOG set "RESTART_LOG=server_logs\restart-ghost.log"
>> "%RESTART_LOG%" echo %~1
exit /b 0
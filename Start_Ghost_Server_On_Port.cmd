@echo off
setlocal EnableExtensions
REM Launch ghost-server.js with NHP_GHOST_PORT=%1 (default 3019). Used by startup .bat/.sh parity and extension native launcher.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not in PATH. Install from https://nodejs.org/
    exit /b 1
)

if not exist "package.json" (
    echo ERROR: package.json not found in "%CD%"
    exit /b 1
)

set "GHOST_PORT=%~1"
if "%GHOST_PORT%"=="" set "GHOST_PORT=3019"

if /i "%~2"=="hidden" (
    if exist "%~dp0Start_Ghost_Server_On_Port_Hidden.cmd" (
        call "%~dp0Start_Ghost_Server_On_Port_Hidden.cmd" "%GHOST_PORT%" %~3
        exit /b %ERRORLEVEL%
    )
    if not exist "server_logs" mkdir "server_logs"
    set "NHP_GHOST_PORT=%GHOST_PORT%"
    start "" /MIN cmd /c "set NHP_GHOST_PORT=%GHOST_PORT% && node ghost-server.js 1>>server_logs\ghost-%GHOST_PORT%.out.log 2>>server_logs\ghost-%GHOST_PORT%.err.log"
    exit /b 0
)

set "NHP_GHOST_PORT=%GHOST_PORT%"
title NHP Ghost Server port %GHOST_PORT%

node ghost-server.js
exit /b %ERRORLEVEL%

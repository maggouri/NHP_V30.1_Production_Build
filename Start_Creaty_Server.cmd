@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions
cd /d "%~dp0"

call "%~dp0NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 (
    echo ❌ Node.js غير موجود في PATH — ثبّته من https://nodejs.org/
    exit /b 1
)

if not exist "package.json" (
    echo ❌ package.json غير موجود في "%CD%"
    exit /b 1
)

if not exist "server_logs" mkdir "server_logs"

set "NHP_CREATY_PORT=3020"
title Creaty Server (port 3020)
echo ========================================
echo    Creaty Server — TeePublic Signup
echo    Port: 3020
echo ========================================
echo.

node creaty-server.js
exit /b %ERRORLEVEL%

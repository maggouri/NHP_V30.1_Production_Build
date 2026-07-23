@echo off
setlocal

cd /d "%~dp0"
title NHP Pinterest Server Setup

echo ==========================================
echo NHP Pinterest Server Setup
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not added to PATH.
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] package.json was not found in this folder.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] node_modules not found.
    echo [INFO] Running npm install...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        echo.
        pause
        exit /b 1
    )
) else (
    echo [INFO] node_modules already exists. Skipping npm install.
)

echo.
echo [INFO] Starting pinterest-server.js...
echo.
node pinterest-server.js

echo.
echo [INFO] The Pinterest server process has stopped.
pause

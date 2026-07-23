@echo off
setlocal

cd /d "%~dp0"
title NHP Server Setup

echo ==========================================
echo NHP Server Setup
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not added to PATH.
    echo.
    echo Please install Node.js first, then run this file again.
    echo Download:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] package.json was not found in this folder.
    echo Make sure this file is inside the project folder.
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
        echo Check your internet connection and npm/Node.js installation.
        echo.
        pause
        exit /b 1
    )
) else (
    echo [INFO] node_modules already exists. Skipping npm install.
)

echo.
echo [INFO] Starting ghost-server.js...
echo.
node ghost-server.js

echo.
echo [INFO] The server process has stopped.
pause

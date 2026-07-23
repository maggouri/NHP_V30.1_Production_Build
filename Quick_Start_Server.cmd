@echo off
echo ========================================
echo    NHP Server Launcher - Direct Start
echo ========================================
echo.

cd /d "%~dp0"
echo Current Directory: %CD%
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
) else (
    echo [OK] Node.js found
)

REM Check package.json
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Please run this script from the NHP project directory
    echo.
    pause
    exit /b 1
) else (
    echo [OK] package.json found
)

REM Check node_modules
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        echo.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies found
)

echo.
echo ========================================
echo Starting NHP Server...
echo ========================================
echo.

REM Start the server
if "%1"=="pinterest" (
    echo Starting Pinterest Server on port 3023...
    node pinterest-server.js
) else (
    echo Starting Ghost Server on port 3019...
    node ghost-server.js
)

if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start!
    echo Check the error messages above.
    echo.
    pause
) else (
    echo.
    echo [SUCCESS] Server started successfully!
    echo.
)
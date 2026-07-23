@echo off
setlocal
:: تفعيل الصلاحيات كمسؤول
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run this file as Administrator!
    echo.
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:\=\\%"
set "PROJECT_CMD_DIR=%~dp0"
if "%PROJECT_CMD_DIR:~-1%"=="\" set "PROJECT_CMD_DIR=%PROJECT_CMD_DIR:~0,-1%"

echo ==========================================
echo Registering NHP Custom Protocol
echo ==========================================
echo Project Path: %~dp0
echo.

:: تسجيل البروتوكول nhp-pro
reg add "HKCR\nhp-pro" /ve /t REG_SZ /d "URL:NHP Protocol" /f
reg add "HKCR\nhp-pro" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCR\nhp-pro\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\cmd.exe\" /c \"cd /d \"%PROJECT_CMD_DIR%\" && call Start_Server_Setup_Silent.cmd\"" /f

:: تسجيل الأوامر الفرعية (إضافي للتبديل)
reg add "HKCR\nhp-pro-ghost" /ve /t REG_SZ /d "URL:NHP Ghost Protocol" /f
reg add "HKCR\nhp-pro-ghost" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCR\nhp-pro-ghost\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\cmd.exe\" /c \"cd /d \"%PROJECT_CMD_DIR%\" && call Start_Server_Setup_Silent.cmd\"" /f

reg add "HKCR\nhp-pro-pinterest" /ve /t REG_SZ /d "URL:NHP Pinterest Protocol" /f
reg add "HKCR\nhp-pro-pinterest" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCR\nhp-pro-pinterest\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\cmd.exe\" /c \"cd /d \"%PROJECT_CMD_DIR%\" && call Start_Pinterest_Server_Silent.cmd\"" /f

echo.
echo [SUCCESS] Protocol registered successfully!
echo.
echo Now the "Start Server" button in the extension will work.
echo.
pause

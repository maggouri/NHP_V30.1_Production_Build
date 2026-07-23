@echo off
setlocal

set "PROJECT_CMD_DIR=%~dp0"
if "%PROJECT_CMD_DIR:~-1%"=="\" set "PROJECT_CMD_DIR=%PROJECT_CMD_DIR:~0,-1%"

echo ==========================================
echo Registering NHP Account Protocol for current user
echo ==========================================
echo Project Path: %PROJECT_CMD_DIR%
echo.

reg add "HKCU\Software\Classes\nhp-account" /ve /t REG_SZ /d "URL:NHP Account Protocol" /f
reg add "HKCU\Software\Classes\nhp-account" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\nhp-account\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe\" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PROJECT_CMD_DIR%\Start_Account_Browser.ps1\" \"%%1\"" /f

echo.
echo [SUCCESS] nhp-account protocol registered for current user.
echo.

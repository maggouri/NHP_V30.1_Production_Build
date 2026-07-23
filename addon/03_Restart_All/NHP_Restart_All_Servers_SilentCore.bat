@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

set "RST_DIR=%~dp0"
if "%RST_DIR:~-1%"=="\" set "RST_DIR=%RST_DIR:~0,-1%"
for %%I in ("%RST_DIR%\..") do set "ADDON_DIR=%%~fI"

call "%ADDON_DIR%\02_Stop_All\NHP_Stop_All_Servers_SilentCore.bat"
timeout /t 3 /nobreak >nul
call "%ADDON_DIR%\01_Start_All\NHP_Start_All_Servers_SilentCore.bat"
exit /b %ERRORLEVEL%
@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

set "RST_DIR=%~dp0"
if "%RST_DIR:~-1%"=="\" set "RST_DIR=%RST_DIR:~0,-1%"
for %%I in ("%RST_DIR%\..") do set "ADDON_DIR=%%~fI"

call "%ADDON_DIR%\_shared\NHP_Stop_All_Servers_SilentCore.cmd"
timeout /t 3 /nobreak >nul
call "%ADDON_DIR%\_shared\NHP_Start_All_Servers_SilentCore.cmd"
exit /b %ERRORLEVEL%

@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
call "%~dp0..\..\_shared\_NHP_Init.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Stop_Ghost_On_Port.ps1" -Port 3024
exit /b %ERRORLEVEL%

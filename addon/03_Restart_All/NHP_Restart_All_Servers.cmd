@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Restart All Servers
echo Stopping all servers...
call "%~dp0..\_shared\NHP_Stop_All_Servers_SilentCore.cmd"
timeout /t 3 /nobreak >nul
echo Starting all servers...
call "%~dp0..\01_Start_All\NHP_Start_All_Servers.cmd"
exit /b %ERRORLEVEL%

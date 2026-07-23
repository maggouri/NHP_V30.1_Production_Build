@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP Portable - Start All Servers
REM Portable entry -> organized Start All (sets env + launches all 8)
call "%~dp0addon\01_Start_All\NHP_Start_All_Servers.bat" %*
exit /b %ERRORLEVEL%
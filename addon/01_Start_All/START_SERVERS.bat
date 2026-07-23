@echo off
setlocal EnableExtensions
title NHP - Start All Servers (Portable)
REM Unified portable launcher -> Start All SilentCore (organized)
call "%~dp0NHP_Start_All_Servers.bat"
exit /b %ERRORLEVEL%
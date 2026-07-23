@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call "%~dp0Start_Pinterest_Server_Background.cmd"
exit /b %ERRORLEVEL%
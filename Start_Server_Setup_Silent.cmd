@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call "%~dp0Start_Ghost_Server_On_Port_Hidden.cmd" 3019
exit /b %ERRORLEVEL%
@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
call "%~dp0..\..\_shared\_NHP_Init.cmd"
call "%NHP_ROOT%\Stop_Creaty_Server.cmd" >nul 2>&1
exit /b %ERRORLEVEL%

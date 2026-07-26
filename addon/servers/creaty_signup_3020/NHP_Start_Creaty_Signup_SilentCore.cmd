@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
call "%~dp0..\..\_shared\_NHP_Init.cmd"
call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%"
call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 exit /b 1
if not exist "%NHP_ROOT%\package.json" exit /b 1
if not exist "%NHP_DATA_ROOT%\server_logs" mkdir "%NHP_DATA_ROOT%\server_logs"
call "%NHP_ROOT%\Start_Creaty_Server_Background.cmd" force
exit /b %ERRORLEVEL%

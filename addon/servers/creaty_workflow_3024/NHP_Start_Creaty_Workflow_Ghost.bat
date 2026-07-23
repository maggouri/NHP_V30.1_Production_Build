@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Start Creaty Workflow Ghost (3024)
call "%~dp0..\..\_shared\_NHP_Init.cmd"
call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%"
call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 ( echo ERROR: Node.js غير متوفر في PATH. & pause & exit /b 1 )
if not exist "%NHP_ROOT%\package.json" ( echo ERROR: package.json غير موجود. & pause & exit /b 1 )
if not exist "%NHP_DATA_ROOT%\server_logs" mkdir "%NHP_DATA_ROOT%\server_logs"
echo تشغيل Creaty Workflow Ghost (3024)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Start_Ghost_On_Port.ps1" -Port 3024 -MaxWaitSeconds 90
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1"
pause
endlocal

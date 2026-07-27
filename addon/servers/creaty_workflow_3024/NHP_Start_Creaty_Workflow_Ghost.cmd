@echo off
setlocal EnableExtensions
title NHP - Start Creaty Workflow Ghost (3024)
call "%~dp0..\..\_shared\_NHP_Init.cmd"
if errorlevel 1 (
  echo ERROR: init failed.
  pause
  exit /b 1
)
call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%"
if errorlevel 1 (
  echo ERROR: data env failed.
  pause
  exit /b 1
)
call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 (
  echo.
  echo ERROR: Node.js not found / Node.js introuvable.
  echo Install LTS: https://nodejs.org/
  echo Or place portable node at: runtime\node\node.exe
  echo.
  pause
  exit /b 1
)
if not exist "%NHP_ROOT%\package.json" (
  echo ERROR: package.json missing under "%NHP_ROOT%"
  pause
  exit /b 1
)
if not exist "%NHP_DATA_ROOT%\server_logs" mkdir "%NHP_DATA_ROOT%\server_logs"
echo Starting Creaty Workflow Ghost (3024) ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Start_Ghost_On_Port.ps1" -Port 3024 -MaxWaitSeconds 90
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1"
pause
endlocal

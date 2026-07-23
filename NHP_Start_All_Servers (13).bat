@echo off
setlocal EnableExtensions
REM NHP — TeePublic / Redbubble / Amazon Ghost + Pinterest Ghost + AI Bridge (hidden background; logs in server_logs).
REM Requires Start_Ghost_Server_On_Port.cmd in this folder.
REM Dashboard "Manager" checks http://127.0.0.1:3009 — that listener is not started by this repo; run your NHP Manager separately if you need it.
set "NHP_ROOT=%~dp0"
if "%NHP_ROOT:~-1%"=="\" set "NHP_ROOT=%NHP_ROOT:~0,-1%"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not in PATH. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\package.json" (
  echo ERROR: package.json not found under "%NHP_ROOT%"
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\Start_Ghost_Server_On_Port.cmd" (
  echo ERROR: Start_Ghost_Server_On_Port.cmd not found under "%NHP_ROOT%"
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\server_logs" mkdir "%NHP_ROOT%\server_logs"

if not exist "%NHP_ROOT%\Start_Ghost_Server_On_Port_Hidden.cmd" (
  echo ERROR: Start_Ghost_Server_On_Port_Hidden.cmd not found under "%NHP_ROOT%"
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\Start_Pinterest_Server_Background.cmd" (
  echo ERROR: Start_Pinterest_Server_Background.cmd not found under "%NHP_ROOT%"
  pause
  exit /b 1
)

if not exist "%NHP_ROOT%\Start_AI_Bridge_Server_Background.cmd" (
  echo ERROR: Start_AI_Bridge_Server_Background.cmd not found under "%NHP_ROOT%"
  pause
  exit /b 1
)

echo Starting NHP servers in the background (no console windows)...

call "%NHP_ROOT%\Start_Ghost_Server_On_Port_Hidden.cmd" 3019
echo [Creaty] TeePublic Signup (3020)...
call "%NHP_ROOT%\Start_Creaty_Server_Background.cmd"
call "%NHP_ROOT%\Start_Ghost_Server_On_Port_Hidden.cmd" 3021
call "%NHP_ROOT%\Start_Ghost_Server_On_Port_Hidden.cmd" 3022
call "%NHP_ROOT%\Start_Pinterest_Server_Background.cmd"
call "%NHP_ROOT%\Start_AI_Bridge_Server_Background.cmd"

echo.
echo Done: 5 servers run in background. Optional Manager on 3009 was not started.
echo Logs: %NHP_ROOT%\server_logs\
echo This window closes in 5 seconds...
timeout /t 5 /nobreak ^>nul
endlocal

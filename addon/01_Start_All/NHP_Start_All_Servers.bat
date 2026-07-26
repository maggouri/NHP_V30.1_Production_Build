@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
title NHP - Start All Servers

set "START_DIR=%~dp0"
if "%START_DIR:~-1%"=="\" set "START_DIR=%START_DIR:~0,-1%"
for %%I in ("%START_DIR%\..") do set "ADDON_DIR=%%~fI"
for %%I in ("%ADDON_DIR%\..") do set "NHP_ROOT=%%~fI"

cd /d "%NHP_ROOT%"

call "%ADDON_DIR%\_shared\_NHP_Portable_Init.cmd"
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "%NHP_DATA_ROOT%\server_logs" mkdir "%NHP_DATA_ROOT%\server_logs"
set "START_LOG=%NHP_LOG_DIR%\start-all.log"

echo.
echo ========================================
echo   NHP - Starting all 8 servers
echo ========================================
echo App Root:  %NHP_APP_ROOT%
echo Data Root: %NHP_DATA_ROOT%
echo Logs:      %NHP_LOG_DIR%
echo.

echo [1/8] TeePublic Ghost (3019)...
call :LaunchOne "%ADDON_DIR%\servers\teepublic_ghost_3019\NHP_Start_TeePublic_Ghost_SilentCore.bat" "TeePublic_3019"
echo [2/8] Creaty Signup (3020)...
call :LaunchOne "%ADDON_DIR%\servers\creaty_signup_3020\NHP_Start_Creaty_Signup_SilentCore.bat" "CreatySignup_3020"
echo [3/8] Redbubble Ghost (3021)...
call :LaunchOne "%ADDON_DIR%\servers\redbubble_ghost_3021\NHP_Start_Redbubble_Ghost_SilentCore.bat" "Redbubble_3021"
echo [4/8] Amazon Ghost (3022)...
call :LaunchOne "%ADDON_DIR%\servers\amazon_ghost_3022\NHP_Start_Amazon_Ghost_SilentCore.bat" "Amazon_3022"
echo [5/8] Pinterest Ghost (3023)...
call :LaunchOne "%ADDON_DIR%\servers\pinterest_ghost_3023\NHP_Start_Pinterest_Ghost_SilentCore.bat" "Pinterest_3023"
echo [6/8] Creaty Workflow Ghost (3024)...
call :LaunchOne "%ADDON_DIR%\servers\creaty_workflow_3024\NHP_Start_Creaty_Workflow_Ghost_SilentCore.bat" "CreatyWorkflow_3024"
echo [7/8] AI Bridge (3031)...
call :LaunchOne "%ADDON_DIR%\servers\ai_bridge_3031\NHP_Start_AI_Bridge_SilentCore.bat" "AIBridge_3031"
echo [8/8] CLIProxyAPI Local (8317)...
call :LaunchOne "%ADDON_DIR%\servers\cliproxy_8317\NHP_Start_CLIProxyAPI_Local_SilentCore.bat" "CLIProxy_8317"

echo.
echo Waiting for servers (up to 120s)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1" -WaitForAll -MaxWaitSeconds 120

echo.
echo ========================================
echo   Server status
echo ========================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1"
echo.
echo Logs: %NHP_LOG_DIR%
echo Tip: use addon\_shared\NHP_Start_All_Servers_Hidden.vbs for zero windows.
echo.
echo Press any key to close this window...
pause >nul
endlocal
exit /b 0

:LaunchOne
if not exist "%~1" (
  echo   ERROR: missing %~1
  echo [%DATE% %TIME%] MISSING %~1>> "%START_LOG%"
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','call \"%~1\"' -WorkingDirectory '%NHP_ROOT%' -WindowStyle Hidden"
echo [%DATE% %TIME%] launched %~2>> "%START_LOG%"
exit /b 0
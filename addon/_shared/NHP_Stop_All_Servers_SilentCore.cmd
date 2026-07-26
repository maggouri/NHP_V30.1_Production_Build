@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

set "STOP_DIR=%~dp0"
if "%STOP_DIR:~-1%"=="\" set "STOP_DIR=%STOP_DIR:~0,-1%"
for %%I in ("%STOP_DIR%\..") do set "ADDON_DIR=%%~fI"
for %%I in ("%ADDON_DIR%\..") do set "NHP_ROOT=%%~fI"

cd /d "%NHP_ROOT%"
call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd" 2>nul
call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%" 2>nul

echo Stopping TeePublic Ghost (3019)...
call "%ADDON_DIR%\servers\teepublic_ghost_3019\NHP_Stop_TeePublic_Ghost_SilentCore.cmd" >nul 2>&1
echo Stopping Creaty Signup (3020)...
call "%ADDON_DIR%\servers\creaty_signup_3020\NHP_Stop_Creaty_Signup_SilentCore.cmd" >nul 2>&1
echo Stopping Redbubble Ghost (3021)...
call "%ADDON_DIR%\servers\redbubble_ghost_3021\NHP_Stop_Redbubble_Ghost_SilentCore.cmd" >nul 2>&1
echo Stopping Amazon Ghost (3022)...
call "%ADDON_DIR%\servers\amazon_ghost_3022\NHP_Stop_Amazon_Ghost_SilentCore.cmd" >nul 2>&1
echo Stopping Pinterest Ghost (3023)...
call "%ADDON_DIR%\servers\pinterest_ghost_3023\NHP_Stop_Pinterest_Ghost_SilentCore.cmd" >nul 2>&1
echo Stopping Creaty Workflow Ghost (3024)...
call "%ADDON_DIR%\servers\creaty_workflow_3024\NHP_Stop_Creaty_Workflow_Ghost_SilentCore.cmd" >nul 2>&1
echo Stopping AI Bridge (3031)...
call "%ADDON_DIR%\servers\ai_bridge_3031\NHP_Stop_AI_Bridge_SilentCore.cmd" >nul 2>&1
echo Stopping CLIProxyAPI Local (8317)...
call "%ADDON_DIR%\servers\cliproxy_8317\NHP_Stop_CLIProxyAPI_Local_SilentCore.cmd" >nul 2>&1

endlocal
exit /b 0
@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "HOST_SCRIPT=%SCRIPT_DIR%nhp_native_host.js"
set "NODE_EXE="

where node >nul 2>nul
if not errorlevel 1 set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\node\node.exe" set "NODE_EXE=%LocalAppData%\Programs\node\node.exe"
if not defined NODE_EXE if exist "%~dp0..\runtime\node\node.exe" set "NODE_EXE=%~dp0..\runtime\node\node.exe"

if not defined NODE_EXE exit /b 1

"%NODE_EXE%" "%HOST_SCRIPT%" %*

@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
set "HOST_SCRIPT=%SCRIPT_DIR%nhp_native_host.js"

REM Chrome launches native hosts with a minimal PATH — bootstrap Node like Register/FIRST_RUN.
set "ENSURE_NODE=%SCRIPT_DIR%..\NHP_Ensure_Node_In_Path.cmd"
if exist "%ENSURE_NODE%" (
  call "%ENSURE_NODE%" >nul 2>nul
)

where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 if exist "%LocalAppData%\Programs\node\node.exe" set "PATH=%LocalAppData%\Programs\node;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    "%ProgramFiles%\nodejs\node.exe" "%HOST_SCRIPT%" %*
    exit /b %ERRORLEVEL%
  )
  if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    "%ProgramFiles(x86)%\nodejs\node.exe" "%HOST_SCRIPT%" %*
    exit /b %ERRORLEVEL%
  )
  if exist "%LocalAppData%\Programs\nodejs\node.exe" (
    "%LocalAppData%\Programs\nodejs\node.exe" "%HOST_SCRIPT%" %*
    exit /b %ERRORLEVEL%
  )
  exit /b 1
)

node "%HOST_SCRIPT%" %*
exit /b %ERRORLEVEL%

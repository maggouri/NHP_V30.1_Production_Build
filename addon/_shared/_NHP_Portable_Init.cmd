@echo off
REM Portable bootstrap: node check, npm install, .env and CLIProxy config.
REM No setlocal -- NHP_APP_ROOT / NHP_DATA_ROOT must remain visible to callers.

set "SHARED_DIR=%~dp0"
if "%SHARED_DIR:~-1%"=="\" set "SHARED_DIR=%SHARED_DIR:~0,-1%"
for %%I in ("%SHARED_DIR%\..") do set "ADDON_DIR=%%~fI"
for %%I in ("%ADDON_DIR%\..") do set "NHP_ROOT=%%~fI"

call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%"
if errorlevel 1 exit /b 1

call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org/ then run again.
  echo.
  exit /b 1
)

if not exist "%NHP_ROOT%\package.json" (
  echo ERROR: package.json not found in "%NHP_ROOT%"
  exit /b 1
)

if not exist "%NHP_ROOT%\node_modules" (
  echo [Portable] Running npm install - this may take several minutes...
  pushd "%NHP_ROOT%"
  call npm install --omit=dev
  if errorlevel 1 (
    popd
    echo ERROR: npm install failed
    exit /b 1
  )
  popd
  echo [Portable] npm install completed.
)

if not exist "%NHP_ROOT%\.env" (
  if exist "%NHP_ROOT%\.env.example" (
    copy /Y "%NHP_ROOT%\.env.example" "%NHP_ROOT%\.env" >nul
    echo [Portable] Created .env from .env.example
  )
)

set "CLIPROXY_DIR=%ADDON_DIR%\cliproxyapi-local"
if not exist "%CLIPROXY_DIR%\config.yaml" (
  if exist "%CLIPROXY_DIR%\config.example.yaml" (
    copy /Y "%CLIPROXY_DIR%\config.example.yaml" "%CLIPROXY_DIR%\config.yaml" >nul
    echo [Portable] Created cliproxyapi-local\config.yaml
  )
)

if not exist "%CLIPROXY_DIR%\auths" mkdir "%CLIPROXY_DIR%\auths"
if not exist "%NHP_DATA_ROOT%\server_logs" mkdir "%NHP_DATA_ROOT%\server_logs"
if not exist "%NHP_DATA_ROOT%\.tmp" mkdir "%NHP_DATA_ROOT%\.tmp"

exit /b 0
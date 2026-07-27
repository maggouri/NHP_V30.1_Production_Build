@echo off
REM Portable bootstrap: node check, npm install, .env and CLIProxy config.
REM No setlocal -- NHP_APP_ROOT / NHP_DATA_ROOT must remain visible to callers.

set "SHARED_DIR=%~dp0"
if "%SHARED_DIR:~-1%"=="\" set "SHARED_DIR=%SHARED_DIR:~0,-1%"
for %%I in ("%SHARED_DIR%\..") do set "ADDON_DIR=%%~fI"
for %%I in ("%ADDON_DIR%\..") do set "NHP_ROOT=%%~fI"

if not defined NHP_ROOT (
  echo.
  echo ERROR: Could not resolve NHP project root from script location.
  echo ERREUR: Impossible de resoudre la racine du projet NHP.
  echo.
  exit /b 1
)
if not exist "%NHP_ROOT%\manifest.json" (
  echo.
  echo ERROR: Invalid NHP root: "%NHP_ROOT%"
  echo Copy the FULL extension folder not only addon\
  echo ERREUR: Racine NHP invalide. Copiez TOUT le dossier extension, pas seulement addon\
  echo.
  exit /b 1
)

call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%"
if errorlevel 1 exit /b 1

if not defined NHP_DATA_ROOT (
  echo ERROR: NHP_DATA_ROOT was not set.
  exit /b 1
)

call "%NHP_ROOT%\NHP_Ensure_Node_In_Path.cmd"
if errorlevel 1 (
  echo.
  echo ========================================
  echo  Node.js missing / Node.js introuvable
  echo ========================================
  echo EN: Node.js is not installed or not in PATH.
  echo     Install Node.js LTS from https://nodejs.org/
  echo     OR drop portable node.exe into:
  echo       runtime\node\node.exe
  echo FR: Node.js n'est pas installe ou pas dans le PATH.
  echo     Installez Node.js LTS: https://nodejs.org/
  echo     OU placez un Node portable dans:
  echo       runtime\node\node.exe
  echo Then run this script again / Puis relancez.
  echo ========================================
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

REM Chrome NM host path must be absolute - rewrite to this App Root after folder moves.
if exist "%NHP_ROOT%\utils\nhp-repair-native-host-path.ps1" (
  if exist "%NHP_ROOT%\native-host\nhp_native_host.cmd" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\utils\nhp-repair-native-host-path.ps1" -ProjectDir "%NHP_ROOT%" >nul 2>&1
  )
)

exit /b 0

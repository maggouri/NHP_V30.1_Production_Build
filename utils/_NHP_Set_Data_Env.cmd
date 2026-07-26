@echo off
REM Sets NHP_APP_ROOT / NHP_DATA_ROOT / NHP_ROOT / NHP_LOG_DIR in the CALLER scope.
REM Usage: call "%~dp0_NHP_Set_Data_Env.cmd" "C:\path\to\extension"
REM No setlocal -- variables must remain visible to the parent script.

if not "%~1"=="" (
  set "NHP_APP_ROOT=%~1"
) else if defined NHP_APP_ROOT (
  rem keep existing
) else if defined NHP_ROOT (
  set "NHP_APP_ROOT=%NHP_ROOT%"
) else (
  set "NHP_APP_ROOT=%~dp0.."
)

if "%NHP_APP_ROOT:~-1%"=="\" set "NHP_APP_ROOT=%NHP_APP_ROOT:~0,-1%"
for %%I in ("%NHP_APP_ROOT%") do set "NHP_APP_ROOT=%%~fI"

if not defined NHP_DATA_ROOT (
  for %%I in ("%NHP_APP_ROOT%\..") do set "NHP_DATA_ROOT=%%~fI\NHP_DATA"
) else (
  for %%I in ("%NHP_DATA_ROOT%") do set "NHP_DATA_ROOT=%%~fI"
)

set "NHP_ROOT=%NHP_APP_ROOT%"
set "NHP_ROOT_DIR=%NHP_APP_ROOT%"
set "NHP_LOG_DIR=%NHP_DATA_ROOT%\server_logs"

if not exist "%NHP_DATA_ROOT%" mkdir "%NHP_DATA_ROOT%"
for %%D in (
  generated_designs
  server_logs
  server_profiles
  server_profiles_creaty
  server_profiles_creaty_preview
  server_profiles_pinterest
  profile_backups
  profile_backups_pinterest
  profile_browser_locks
  temp_uploads
  temp_uploads_ai_bridge
  temp_uploads_pinterest
  metadata_store
  backups
  .tmp
  archive
) do (
  if not exist "%NHP_DATA_ROOT%\%%D" mkdir "%NHP_DATA_ROOT%\%%D"
)

exit /b 0
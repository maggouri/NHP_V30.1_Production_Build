@echo off
REM Internal helper (addon\_shared): resolve App Root and wire NHP_DATA env.
REM No setlocal -- NHP_* must remain visible to the caller.
set "NHP_ROOT=%~dp0..\.."
if "%NHP_ROOT:~-1%"=="\" set "NHP_ROOT=%NHP_ROOT:~0,-1%"
for %%I in ("%NHP_ROOT%") do set "NHP_ROOT=%%~fI"
call "%NHP_ROOT%\utils\_NHP_Set_Data_Env.cmd" "%NHP_ROOT%"
exit /b %ERRORLEVEL%
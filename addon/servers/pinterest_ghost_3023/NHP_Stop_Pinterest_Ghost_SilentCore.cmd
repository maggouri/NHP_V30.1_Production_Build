@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
call "%~dp0..\..\_shared\_NHP_Init.cmd"
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3023/shutdown' -Method POST -TimeoutSec 3 | Out-Null } catch {}"
call "%NHP_ROOT%\Stop_Pinterest_Server.cmd" >nul 2>&1
exit /b %ERRORLEVEL%

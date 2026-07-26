@echo off
call "%~dp0addon\_shared\NHP_Restart_All_Servers_SilentCore.bat" %*
exit /b %ERRORLEVEL%

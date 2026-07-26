@echo off
call "%~dp0addon\03_Restart_All\NHP_Restart_All_Servers.bat" %*
exit /b %ERRORLEVEL%

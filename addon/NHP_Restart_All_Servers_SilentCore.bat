@echo off
call "%~dp003_Restart_All\NHP_Restart_All_Servers_SilentCore.bat" %*
exit /b %ERRORLEVEL%
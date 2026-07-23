@echo off
call "%~dp003_Restart_All\NHP_Restart_All_Servers.bat" %*
exit /b %ERRORLEVEL%
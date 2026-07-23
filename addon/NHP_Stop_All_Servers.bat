@echo off
call "%~dp002_Stop_All\NHP_Stop_All_Servers.bat" %*
exit /b %ERRORLEVEL%
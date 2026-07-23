@echo off
call "%~dp0addon\01_Start_All\NHP_Start_All_Servers.bat" %*
exit /b %ERRORLEVEL%
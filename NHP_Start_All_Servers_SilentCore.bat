@echo off
call "%~dp0addon\01_Start_All\NHP_Start_All_Servers_SilentCore.bat" %*
exit /b %ERRORLEVEL%
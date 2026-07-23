@echo off
call "%~dp0addon\02_Stop_All\NHP_Stop_All_Servers_SilentCore.bat" %*
exit /b %ERRORLEVEL%
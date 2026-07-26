@echo off
call "%~dp0addon\_shared\NHP_Stop_All_Servers_SilentCore.bat" %*
exit /b %ERRORLEVEL%

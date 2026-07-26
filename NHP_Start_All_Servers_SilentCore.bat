@echo off
call "%~dp0addon\_shared\NHP_Start_All_Servers_SilentCore.bat" %*
exit /b %ERRORLEVEL%

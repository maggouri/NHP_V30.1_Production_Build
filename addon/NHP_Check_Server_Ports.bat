@echo off
call "%~dp0_shared\NHP_Check_Server_Ports.bat" %*
exit /b %ERRORLEVEL%
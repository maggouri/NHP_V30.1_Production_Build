@echo off
call "%~dp001_Start_All\START_SERVERS.bat" %*
exit /b %ERRORLEVEL%
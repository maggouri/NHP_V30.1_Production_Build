@echo off
REM Legacy root entry — forwards to organized Register folder
call "%~dp0addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.cmd" %*
exit /b %ERRORLEVEL%
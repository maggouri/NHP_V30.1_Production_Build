@echo off
REM Compatibility stub -> addon\00_Register_Native_Messaging
call "%~dp0addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.bat" %*
exit /b %ERRORLEVEL%

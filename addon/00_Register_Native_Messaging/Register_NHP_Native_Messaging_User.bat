@echo off
REM Compatibility shim — use Register_NHP_Native_Messaging_User.cmd
call "%~dp0Register_NHP_Native_Messaging_User.cmd" %*
exit /b %ERRORLEVEL%
@echo off
call "%~dp0_shared\NHP_Ensure_Node_In_Path.bat" %*
exit /b %ERRORLEVEL%
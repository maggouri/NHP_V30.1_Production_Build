@echo off
call "%~dp0servers\cliproxy_8317\NHP_Stop_CLIProxyAPI_Local_SilentCore.bat" %*
exit /b %ERRORLEVEL%
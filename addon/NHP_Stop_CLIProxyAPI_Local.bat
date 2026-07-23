@echo off
call "%~dp0servers\cliproxy_8317\NHP_Stop_CLIProxyAPI_Local.bat" %*
exit /b %ERRORLEVEL%
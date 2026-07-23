@echo off
call "%~dp0servers\amazon_ghost_3022\NHP_Stop_Amazon_Ghost_SilentCore.bat" %*
exit /b %ERRORLEVEL%
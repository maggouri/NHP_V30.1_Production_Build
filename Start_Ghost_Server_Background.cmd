@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start_Ghost_Server_Background.ps1"
pause
exit /b %errorlevel%

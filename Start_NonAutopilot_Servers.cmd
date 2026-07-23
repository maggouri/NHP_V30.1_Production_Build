@echo off
setlocal
cd /d "%~dp0"
REM Order: AI Bridge (3031) then Pinterest (3023); both hidden + logs under server_logs\
call "%~dp0Start_AI_Bridge_Server_Background.cmd"
call "%~dp0Start_Pinterest_Server_Background.cmd"
endlocal

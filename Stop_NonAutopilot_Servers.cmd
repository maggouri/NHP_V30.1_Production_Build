@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3031/shutdown' -Method Post -TimeoutSec 2 | Out-Null } catch { }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3023/shutdown' -Method Post -TimeoutSec 2 | Out-Null } catch { }"
call "%~dp0Stop_AI_Bridge_Server.cmd"
call "%~dp0Stop_Pinterest_Server.cmd"
endlocal

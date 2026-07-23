@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo         Ghost Server Stop Tool
echo ========================================
echo.

powershell -NoProfile -Command "`$pids = Get-CimInstance Win32_Process | Where-Object Name -eq 'node.exe' | Where-Object CommandLine -match 'ghost-server\.js' | Select-Object -ExpandProperty ProcessId; if (`$pids) { Stop-Process -Id `$pids -Force; Write-Output '[SUCCESS] Ghost Server stopped.' } else { Write-Output '[INFO] Ghost Server was not running.' }"

echo.
pause
exit /b 0

@echo off
setlocal
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_PROFILE=%LOCALAPPDATA%\Google\Chrome\User Data"
set "TARGET_URL=https://gemini.google.com/gem/72a0fd652c4a"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:9331/json/version' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
    start "" "%CHROME_EXE%" "%TARGET_URL%"
    exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-Process chrome -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 exit /b 2

start "" "%CHROME_EXE%" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9331 --remote-allow-origins=* --no-first-run --no-default-browser-check --user-data-dir="%CHROME_PROFILE%" --profile-directory=Default --new-window "%TARGET_URL%"
endlocal

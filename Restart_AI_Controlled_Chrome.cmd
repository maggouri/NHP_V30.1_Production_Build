@echo off
setlocal
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_PROFILE=%LOCALAPPDATA%\Google\Chrome\User Data"
set "TARGET_URL=https://gemini.google.com/gem/72a0fd652c4a"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 2"
start "" "%CHROME_EXE%" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9331 --remote-allow-origins=* --no-first-run --no-default-browser-check --user-data-dir="%CHROME_PROFILE%" --profile-directory=Default --new-window "%TARGET_URL%"
endlocal

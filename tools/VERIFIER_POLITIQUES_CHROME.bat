@echo off
chcp 65001 >nul
echo Diagnostic des politiques Chrome...
python "%~dp0diagnose_chrome_policies.py"
echo.
echo Ouverture de chrome://policy et chrome://management ...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory=Default "chrome://policy"
timeout /t 2 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory=Default "chrome://management"
pause

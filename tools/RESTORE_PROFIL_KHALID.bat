@echo off
chcp 65001 >nul
echo ========================================
echo  Restauration profil khalid.maggouri.97
echo  (Chrome Default)
echo ========================================
echo.
echo Fermeture de Chrome...
taskkill /IM chrome.exe /F >nul 2>&1
timeout /t 3 /nobreak >nul
python "%~dp0force_extensions_visible.py"
echo.
pause

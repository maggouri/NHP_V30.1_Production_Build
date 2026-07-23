@echo off
chcp 65001 >nul
echo ============================================
echo   SOLUTION FINALE - Extensions Chrome
echo   Compte: khalid.maggouri.97@gmail.com
echo ============================================
echo.

echo [1/4] Fermeture Chrome...
taskkill /IM chrome.exe /F >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/4] Enregistrement NHP dans le registre Windows...
reg import "%~dp0install_nhp_registry.reg"
if errorlevel 1 (
    echo ERREUR registre. Clic droit sur SOLUTION_FINALE.bat ^> Executer en tant qu administrateur
    pause
    exit /b 1
)

echo [3/4] Reset Preferences (garde les 30 extensions sur disque)...
python "%~dp0reset_prefs_keep_extensions.py"

echo [4/4] Ouverture Chrome avec NHP force...
set "NHP_EXT=%~dp0.."
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
%CHROME% --profile-directory=Default --load-extension="%NHP_EXT%"

echo.
echo ============================================
echo Si chrome://extensions est encore vide:
echo.
echo OPTION A - Nouveau profil + sync Google:
echo   1. Chrome ^> icone profil ^> Ajouter un profil
echo   2. Connectez khalid.maggouri.97@gmail.com
echo   3. Activez la synchronisation des EXTENSIONS
echo   4. Attendez 5 minutes
echo.
echo OPTION B - Reinstaller Chrome:
echo   Parametres ^> Applications ^> Google Chrome ^> Reparer
echo ============================================
pause

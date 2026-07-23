@echo off
setlocal
set "PROJECT_CMD_DIR=%~dp0"
set "PROJECT_CMD_DIR=%PROJECT_CMD_DIR:~0,-1%"
set "PROTOCOL_PS=%PROJECT_CMD_DIR%\Start_NHP_AI_Protocol.ps1"

reg add "HKCU\Software\Classes\nhp-ai-servers" /ve /t REG_SZ /d "URL:NHP AI Servers Protocol" /f
reg add "HKCU\Software\Classes\nhp-ai-servers" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\nhp-ai-servers\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe\" -NoProfile -ExecutionPolicy Bypass -File \"%PROTOCOL_PS%\" \"%%1\"" /f

reg add "HKCU\Software\Classes\nhp-ai-servers-stop" /ve /t REG_SZ /d "URL:NHP AI Servers Stop Protocol" /f
reg add "HKCU\Software\Classes\nhp-ai-servers-stop" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\nhp-ai-servers-stop\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe\" -NoProfile -ExecutionPolicy Bypass -File \"%PROTOCOL_PS%\" \"%%1\"" /f

reg add "HKCU\Software\Classes\nhp-ai-chrome" /ve /t REG_SZ /d "URL:NHP AI Chrome Protocol" /f
reg add "HKCU\Software\Classes\nhp-ai-chrome" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\nhp-ai-chrome\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe\" -NoProfile -ExecutionPolicy Bypass -File \"%PROTOCOL_PS%\" \"%%1\"" /f

reg add "HKCU\Software\Classes\nhp-ai-chrome-restart" /ve /t REG_SZ /d "URL:NHP AI Chrome Restart Protocol" /f
reg add "HKCU\Software\Classes\nhp-ai-chrome-restart" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCU\Software\Classes\nhp-ai-chrome-restart\shell\open\command" /ve /t REG_SZ /d "\"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe\" -NoProfile -ExecutionPolicy Bypass -File \"%PROTOCOL_PS%\" \"%%1\"" /f

echo [SUCCESS] NHP AI protocols registered for current user.
endlocal

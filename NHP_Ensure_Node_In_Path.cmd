@echo off
REM Adds common Node.js install folders to PATH (needed when .bat is double-clicked from Explorer).
where node >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
  exit /b 0
)
if exist "%LocalAppData%\Programs\nodejs\node.exe" (
  set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
  exit /b 0
)
if exist "%LocalAppData%\Programs\node\node.exe" (
  set "PATH=%LocalAppData%\Programs\node;%PATH%"
  exit /b 0
)
exit /b 1

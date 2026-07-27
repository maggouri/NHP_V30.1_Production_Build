@echo off
REM Resolve Node into PATH for Explorer double-click and portable copies.
REM Safe on FR/EN Windows. Order: PATH -> common installs -> portable runtime.

where node >nul 2>nul
if not errorlevel 1 exit /b 0

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  goto :NHP_NODE_OK
)

REM Never expand ProgramFiles(x86) unquoted inside a parenthesized block.
set "NHP_PF86=%ProgramFiles(x86)%"
if defined NHP_PF86 (
  if exist "%NHP_PF86%\nodejs\node.exe" (
    set "PATH=%NHP_PF86%\nodejs;%PATH%"
    goto :NHP_NODE_OK
  )
)

if exist "%LocalAppData%\Programs\nodejs\node.exe" (
  set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
  goto :NHP_NODE_OK
)

if exist "%LocalAppData%\Programs\node\node.exe" (
  set "PATH=%LocalAppData%\Programs\node;%PATH%"
  goto :NHP_NODE_OK
)

REM Optional portable Node - see runtime\node\README.txt
if exist "%~dp0runtime\node\node.exe" (
  set "PATH=%~dp0runtime\node;%PATH%"
  goto :NHP_NODE_OK
)
if exist "%~dp0.tools\node\node.exe" (
  set "PATH=%~dp0.tools\node;%PATH%"
  goto :NHP_NODE_OK
)
if exist "%~dp0addon\runtime\node\node.exe" (
  set "PATH=%~dp0addon\runtime\node;%PATH%"
  goto :NHP_NODE_OK
)

exit /b 1

:NHP_NODE_OK
where node >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0

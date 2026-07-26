Option Explicit
Dim sh, fso, dir, coreBat
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
coreBat = Replace(WScript.ScriptFullName, "_Hidden.vbs", "_SilentCore.bat")
If Not fso.FileExists(coreBat) Then
  WScript.Echo "Missing: " & coreBat
  WScript.Quit 1
End If
dir = fso.GetParentFolderName(coreBat)
sh.CurrentDirectory = dir
sh.Run "cmd.exe /c """ & coreBat & """", 0, False
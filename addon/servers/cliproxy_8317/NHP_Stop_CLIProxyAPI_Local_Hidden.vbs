Option Explicit

Dim sh, coreBat

Set sh = CreateObject("WScript.Shell")

coreBat = Replace(WScript.ScriptFullName, "_Hidden.vbs", "_SilentCore.bat")

sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(coreBat)

sh.Run "cmd.exe /c """ & coreBat & """", 0, False


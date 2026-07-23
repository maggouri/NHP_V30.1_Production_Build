' Stop all NHP node servers (hidden). Double-click or: wscript.exe //B NHP_Stop_All_Servers_Hidden.vbs
Option Explicit
Dim sh, fso, dir, coreBat
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
coreBat = dir & "\NHP_Stop_All_Servers_SilentCore.bat"
If Not fso.FileExists(coreBat) Then
  WScript.Echo "Missing: " & coreBat
  WScript.Quit 1
End If
sh.CurrentDirectory = dir
sh.Run "cmd.exe /c """ & coreBat & """", 0, False

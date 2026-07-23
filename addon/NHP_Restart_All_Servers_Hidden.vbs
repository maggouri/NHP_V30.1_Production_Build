' Compatibility stub -> 03_Restart_All\NHP_Restart_All_Servers_Hidden.vbs
Option Explicit
Dim sh, fso, target
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
target = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "03_Restart_All\NHP_Restart_All_Servers_Hidden.vbs")
If Not fso.FileExists(target) Then
  WScript.Echo "Missing: " & target
  WScript.Quit 1
End If
sh.Run "wscript.exe //B """ & target & """", 0, False
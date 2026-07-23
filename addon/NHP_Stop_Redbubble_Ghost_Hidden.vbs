' Compatibility stub -> servers\redbubble_ghost_3021\NHP_Stop_Redbubble_Ghost_Hidden.vbs
Option Explicit
Dim sh, fso, target
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
target = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "servers\redbubble_ghost_3021\NHP_Stop_Redbubble_Ghost_Hidden.vbs")
If Not fso.FileExists(target) Then
  WScript.Echo "Missing: " & target
  WScript.Quit 1
End If
sh.Run "wscript.exe //B """ & target & """", 0, False
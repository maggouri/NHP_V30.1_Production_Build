' Runs ghost-server.js with no visible console; cwd = folder containing this script (project root).
Dim sh, fso, dir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "node.exe ghost-server.js", 0, False
Set sh = Nothing
Set fso = Nothing

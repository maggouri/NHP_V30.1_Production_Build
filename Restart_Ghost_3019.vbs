' إعادة تشغيل Ghost Server (3019) — نافذة مخفية (بدون نافذة CMD)
' سجل الأحداث: server_logs\restart-ghost.log (يُكتب من Restart_Ghost_3019.cmd)
' لا تنشئ ملفات _*.log في جذر NHP — Chrome يرفض تحميل الإضافة
Dim sh, fso, dir, cmdPath
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = dir & "\Restart_Ghost_3019.cmd"
sh.CurrentDirectory = dir
sh.Run "cmd.exe /c """ & cmdPath & """", 0, True
Set sh = Nothing
Set fso = Nothing
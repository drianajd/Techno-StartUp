Set fso = CreateObject("Scripting.FileSystemObject")
d = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c """"" & d & "\Gran.bat"" child > """ & d & "\run-log.txt"" 2>&1""", 0, False

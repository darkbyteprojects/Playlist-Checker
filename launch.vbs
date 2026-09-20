Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Make sure Node.js is installed before starting
If sh.Run("cmd /c where node >nul 2>nul", 0, True) <> 0 Then
  MsgBox "Node.js was not found." & vbCrLf & "Install it from https://nodejs.org and try again.", 16, "Playlist Checker"
  WScript.Quit 1
End If

sh.Run "node """ & dir & "\app.js""", 0, False
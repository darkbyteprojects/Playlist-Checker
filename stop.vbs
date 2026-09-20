Set sh = CreateObject("WScript.Shell")

' Stops only the process listening on port 8765 (not every Node.js process)
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }""", 0, True

MsgBox "Playlist Checker has been stopped.", 64, "Playlist Checker"
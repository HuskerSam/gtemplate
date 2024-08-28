
Set-Location 
git pull
Start-Sleep(1)
wt --window 0 -p "Windows PowerShell" -d ".\functions" powershell.exe -NoExit -Command "tsc --watch"
wt --window 0 -p "Windows PowerShell" -d ".\public\uicode" powershell.exe -NoExit -Command "webpack --watch"
wt --window 0 -p "Windows PowerShell" -d ".\public\uicode" powershell.exe -NoExit -Command "npx tailwindcss -i .\..\css\main.css -o .\..\css\output.css --watch"
Start-Sleep(2)
wt --window 0 -p "Windows Powershell" -d ".\" powershell.exe -NoExit -Command "firebase serve"
code .
Start-Sleep(10)
Start-Process "http://localhost:5000/"

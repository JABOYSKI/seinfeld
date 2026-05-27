@echo off
:: Seinfeld deploy — stamps build time into version/sw/index, then pushes.
:: Run from the project root.

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')"') do set TIMESTAMP=%%i

:: Stamp js/version.js (ASCII-only, so a plain echo is safe)
echo // Auto-updated on deploy — do not edit manually> js\version.js
echo export const BUILD_TIME = '%TIMESTAMP%';>> js\version.js

:: Stamp index.html (?v= + SEIN_BUILD_TIME) and sw.js (CACHE name).
:: We use [System.IO.File]::ReadAllText with an explicit UTF-8 (no BOM)
:: encoder instead of Get-Content/Set-Content. Reason: PowerShell 5.1's
:: Get-Content -Raw decodes as the system codepage (Windows-1252 on US
:: machines), which corrupts em dashes, emoji, etc. on the round-trip.
set SEIN_TS=%TIMESTAMP%
powershell -NoProfile -Command "$ts=$env:SEIN_TS;$u=New-Object System.Text.UTF8Encoding($false);$h=[System.IO.File]::ReadAllText('index.html',$u);$h=[regex]::Replace($h,'\?v=[^\"''\s>]*',\"?v=$ts\");$h=[regex]::Replace($h,\"window\.SEIN_BUILD_TIME = '[^']*'\",\"window.SEIN_BUILD_TIME = '$ts'\");[System.IO.File]::WriteAllText('index.html',$h,$u);$sw=[System.IO.File]::ReadAllText('sw.js',$u);$sw=[regex]::Replace($sw,\"'seinfeld-[^']*'\",\"'seinfeld-$ts'\");[System.IO.File]::WriteAllText('sw.js',$sw,$u)"
set SEIN_TS=

:: If this is a git repo with a remote, commit + push. Otherwise just leave
:: the stamped files in place for manual upload.
if exist .git (
  git add -A
  git commit -m "deploy: %TIMESTAMP%"
  git push
)

echo.
echo Stamped BUILD_TIME = %TIMESTAMP%
pause

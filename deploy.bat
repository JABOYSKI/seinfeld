@echo off
:: Seinfeld deploy — stamps build time into version/sw/index, then pushes.
:: Mirrors fubzlifts deploy pattern. Run from the project root.

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')"') do set TIMESTAMP=%%i

:: Stamp js/version.js
echo // Auto-updated on deploy — do not edit manually> js\version.js
echo export const BUILD_TIME = '%TIMESTAMP%';>> js\version.js

:: Stamp SW cache name so the browser detects a new worker on deploy.
:: Replaces the entire single-quoted value: 'seinfeld-...' -> 'seinfeld-<ts>'.
set SEIN_TS=%TIMESTAMP%
powershell -NoProfile -Command "$ts = $env:SEIN_TS; $sw = Get-Content 'sw.js' -Raw; $sw = [regex]::Replace($sw, \"'seinfeld-[^']*'\", \"'seinfeld-$ts'\"); Set-Content -Path 'sw.js' -Value $sw -NoNewline -Encoding UTF8"

:: Stamp BUILD_TIMESTAMP placeholders in index.html:
::   - ?v=... on script/link tags (forces fresh CSS/JS fetch)
::   - window.SEIN_BUILD_TIME = '...' (splash timestamp display)
:: Regex also matches a prior timestamp so re-runs of deploy.bat work.
powershell -NoProfile -Command "$ts = $env:SEIN_TS; $h = Get-Content 'index.html' -Raw; $h = [regex]::Replace($h, '\?v=[^\"''\s>]*', \"?v=$ts\"); $h = [regex]::Replace($h, \"window\.SEIN_BUILD_TIME = '[^']*'\", \"window.SEIN_BUILD_TIME = '$ts'\"); Set-Content -Path 'index.html' -Value $h -NoNewline -Encoding UTF8"
set SEIN_TS=

:: If this is a git repo, commit + push. Otherwise just leave the stamped
:: files in place for manual upload.
if exist .git (
  git add -A
  git commit -m "deploy: %TIMESTAMP%"
  git push
)

echo.
echo Stamped BUILD_TIME = %TIMESTAMP%
pause

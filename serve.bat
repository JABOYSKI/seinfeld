@echo off
:: Local dev server. Modules + service workers require http://, so we can't
:: just double-click index.html.
::
:: Tries Python first, falls back to Node. The plain `python` command on
:: Windows often hits the broken Microsoft Store shim, so we probe the real
:: install paths directly.
setlocal
set PORT=8765

set PY1=%LOCALAPPDATA%\Python\bin\python3.exe
set PY2=%LOCALAPPDATA%\Programs\Python\Python313\python.exe
set PY3=%LOCALAPPDATA%\Programs\Python\Python312\python.exe

echo Serving http://localhost:%PORT%/  (Ctrl+C to stop)

if exist "%PY1%" ( "%PY1%" -m http.server %PORT% & goto :eof )
if exist "%PY2%" ( "%PY2%" -m http.server %PORT% & goto :eof )
if exist "%PY3%" ( "%PY3%" -m http.server %PORT% & goto :eof )

where node >nul 2>&1
if %errorlevel%==0 (
  node serve.mjs %PORT%
  goto :eof
)

echo No Python or Node found. Install Python from python.org or Node.js.
pause

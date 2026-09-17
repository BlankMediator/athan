@echo off
setlocal
title Athan - browser server
pushd "%~dp0" || exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 or newer, then try again.
  goto :failed
)
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Athan needs Node.js 24 or newer. Update Node.js, then try again.
  goto :failed
)
if not exist "browser-ui\index.html" goto :build
if not exist "browser-ui\sw.js" goto :build
goto :serve

:build
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. In this folder, run: npm.cmd ci
  goto :failed
)
echo Building the browser app...
call npm.cmd run build:browser
if errorlevel 1 goto :failed

:serve
rem Localhost works offline without a certificate. LAN mode discovers the matching certificate/key.
set "ATHAN_BROWSER_HOST=127.0.0.1"
node.exe scripts\serve-browser.mjs --open %*
if errorlevel 1 goto :failed
popd
exit /b 0

:failed
echo.
echo Athan could not start. See the message above.
pause
popd
exit /b 1

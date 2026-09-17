@echo off
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Athan needs its desktop dependencies. Run npm.cmd install in this folder first.
  pause
  exit /b 1
)
if not exist "%~dp0desktop-ui\index.html" (
  echo Please run npm.cmd run build in this folder first.
  pause
  exit /b 1
)
start "" /D "%~dp0." "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."

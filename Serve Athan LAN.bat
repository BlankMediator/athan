@echo off
rem Automatically uses certificates\athan-{cert,key}.pem or D:\Certificates\athan-{cert,key}.pem.
rem Pass --http only when deliberately serving without HTTPS.
call "%~dp0Open Athan Browser.cmd" --lan %*
exit /b %errorlevel%

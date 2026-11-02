@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-man-roles.ps1" %*
exit /b %errorlevel%

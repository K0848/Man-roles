@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-man-roles.ps1" %*
exit /b %errorlevel%

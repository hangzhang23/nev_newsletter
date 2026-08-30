@echo off
setlocal
set "STABLE_LAUNCHER=E:\workbuddy\space\.workbuddy\bin\publish-nev.cmd"
if exist "%STABLE_LAUNCHER%" (
  call "%STABLE_LAUNCHER%"
  exit /b %ERRORLEVEL%
)
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0workbuddy-publisher.ps1" -RequestPublication
exit /b %ERRORLEVEL%

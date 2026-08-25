@echo off
setlocal
set "REPO_ROOT=%~dp0.."
if not defined NEV_DATA_DIR set "NEV_DATA_DIR=E:\workbuddy\space"
cd /d "%REPO_ROOT%" || exit /b 1
call npm run publish:data
exit /b %ERRORLEVEL%

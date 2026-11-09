@echo off
cd /d "%~dp0"
set PORT=5176
echo KO-B 로컬 서버: http://localhost:5176
node backend\server.js
pause

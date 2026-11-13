@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Запускаю демо 7cars на http://localhost:5173 ...
start "" "http://localhost:5173/#split"
node server.js

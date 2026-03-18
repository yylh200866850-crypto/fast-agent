@echo off
chcp 65001 >nul
title MongoDB Shell (mongosh)
echo MongoDB Shell
echo Connecting to mongodb://127.0.0.1:27017
echo.
cd /d "%~dp0"
mongosh --host 127.0.0.1 --port 27017
pause

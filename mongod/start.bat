@echo off
chcp 65001 >nul
title MongoDB Server
echo Starting MongoDB Server...
echo Port: 27017
echo Data: ./data
echo Log: ./log/mongod.log
echo.
cd /d "%~dp0"
.\mongod.exe --config mongod.cfg
pause

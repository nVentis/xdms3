@echo OFF
cd /d %~dp0

cd lib/Entities/Server
call npm install

cd ../../../

pause
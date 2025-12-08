@echo off
cd /d "%~dp0"
echo Démarrage du serveur local sur http://localhost:8000 ...
python -m http.server 8000
pause

@echo off
title REAPER AUTH API SERVER
cd /d "%~dp0"
echo ========================================================
echo   INICIALIZANDO SERVIDOR DE AUTENTICACION REAPER.LOL
echo ========================================================
echo.
if not exist node_modules (
    echo [*] Instalando dependencias de Node.js...
    call npm install
)
echo [*] Iniciando servidor con conexion a MongoDB Atlas...
call npm start
pause

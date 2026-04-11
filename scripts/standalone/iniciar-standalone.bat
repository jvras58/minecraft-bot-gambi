@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title Minecraft Bot Gambiarra

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       Minecraft Bot Gambiarra                ║
echo  ║                                              ║
echo  ║  Pre-requisito: Gambiarra Hub rodando        ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Verificar se o executavel existe
if not exist "%~dp0minecraft-bot.exe" (
    echo  ERRO: minecraft-bot.exe nao encontrado nesta pasta!
    pause
    exit /b 1
)

:: ─── Configuracao ────────────────────────────────────────
echo  Configuracao
echo  ════════════════════════════════════════════

set "ROOM_CODE="
set /p "ROOM_CODE=  Room Code do Gambiarra (obrigatorio): "

if "!ROOM_CODE!"=="" (
    echo.
    echo  ERRO: Room Code e obrigatorio!
    pause
    exit /b 1
)

set "HUB_URL=http://localhost:3000"
set /p "HUB_URL=  Hub URL [http://localhost:3000]: "
if "!HUB_URL!"=="" set "HUB_URL=http://localhost:3000"

set "MC_HOST=localhost"
set /p "MC_HOST=  Minecraft Host [localhost]: "
if "!MC_HOST!"=="" set "MC_HOST=localhost"

set "MC_PORT=25565"
set /p "MC_PORT=  Minecraft Porta [25565]: "
if "!MC_PORT!"=="" set "MC_PORT=25565"

set "BOT_NAME=BotGambiarra"
set /p "BOT_NAME=  Nome do Bot [BotGambiarra]: "
if "!BOT_NAME!"=="" set "BOT_NAME=BotGambiarra"

:: ─── Criar .env ──────────────────────────────────────────
(
echo GAMBIARRA_HUB_URL=!HUB_URL!
echo GAMBIARRA_MODEL=*
echo MINECRAFT_HOST=!MC_HOST!
echo MINECRAFT_PORT=!MC_PORT!
echo BOT_USERNAME=!BOT_NAME!
echo BOT_AUTH=offline
) > "%~dp0.env"

:: ─── Iniciar ─────────────────────────────────────────────
echo.
echo  ════════════════════════════════════════════
echo   Room:     !ROOM_CODE!
echo   Hub:      !HUB_URL!
echo   Server:   !MC_HOST!:!MC_PORT!
echo   Bot:      !BOT_NAME!
echo  ════════════════════════════════════════════
echo.
echo  Pressione Ctrl+C para parar o bot.
echo.

"%~dp0minecraft-bot.exe" --room !ROOM_CODE! --hub !HUB_URL!

echo.
echo  Bot encerrado.
pause

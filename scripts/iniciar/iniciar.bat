@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title Minecraft Bot Gambiarra - Launcher

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     Minecraft Bot Gambiarra - Launcher       ║
echo  ║                                              ║
echo  ║  Pre-requisito: Gambiarra Hub rodando        ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ─── Verificar se Bun esta instalado ─────────────────────
echo [1/4] Verificando Bun...

where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  Bun nao encontrado! Instalando automaticamente...
    echo.

    where powershell >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo  ERRO: PowerShell nao encontrado. Instale o Bun manualmente:
        echo  https://bun.sh/docs/installation
        pause
        exit /b 1
    )

    powershell -Command "irm bun.sh/install.ps1 | iex"

    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ERRO: Falha ao instalar o Bun.
        echo  Tente instalar manualmente: https://bun.sh/docs/installation
        pause
        exit /b 1
    )

    :: Atualizar PATH para a sessao atual
    set "BUN_INSTALL=%USERPROFILE%\.bun"
    set "PATH=%BUN_INSTALL%\bin;%PATH%"

    where bun >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  Bun instalado, mas precisa reiniciar o terminal.
        echo  Feche esta janela, abra novamente e rode iniciar.bat de novo.
        pause
        exit /b 1
    )

    echo.
    echo  Bun instalado com sucesso!
) else (
    for /f "tokens=*" %%v in ('bun --version 2^>nul') do set BUN_VERSION=%%v
    echo  Bun encontrado: v!BUN_VERSION!
)

:: ─── Instalar dependencias ───────────────────────────────
echo.
echo [2/4] Instalando dependencias...
echo.

cd /d "%~dp0"
call bun install

if %ERRORLEVEL% neq 0 (
    echo.
    echo  ERRO: Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo  Dependencias instaladas!

:: ─── Configuracao ────────────────────────────────────────
echo.
echo [3/4] Configuracao
echo.
echo  ════════════════════════════════════════════

:: Room Code
set "ROOM_CODE="
set /p "ROOM_CODE=  Room Code do Gambiarra (obrigatorio): "

if "!ROOM_CODE!"=="" (
    echo.
    echo  ERRO: Room Code e obrigatorio!
    pause
    exit /b 1
)

:: Hub URL
set "HUB_URL=http://localhost:3000"
set /p "HUB_URL=  Hub URL [http://localhost:3000]: "
if "!HUB_URL!"=="" set "HUB_URL=http://localhost:3000"

:: Minecraft Server
set "MC_HOST=localhost"
set /p "MC_HOST=  Minecraft Host [localhost]: "
if "!MC_HOST!"=="" set "MC_HOST=localhost"

set "MC_PORT=25565"
set /p "MC_PORT=  Minecraft Porta [25565]: "
if "!MC_PORT!"=="" set "MC_PORT=25565"

set "BOT_NAME=BotGambiarra"
set /p "BOT_NAME=  Nome do Bot [BotGambiarra]: "
if "!BOT_NAME!"=="" set "BOT_NAME=BotGambiarra"

:: ─── Criar/Atualizar .env ────────────────────────────────
echo.
echo  Salvando configuracao no .env...

(
echo # Gerado por iniciar.bat
echo GAMBIARRA_HUB_URL=!HUB_URL!
echo GAMBIARRA_MODEL=*
echo MINECRAFT_HOST=!MC_HOST!
echo MINECRAFT_PORT=!MC_PORT!
echo BOT_USERNAME=!BOT_NAME!
echo BOT_AUTH=offline
) > "%~dp0.env"

echo  .env atualizado!

:: ─── Abrir Dashboard ─────────────────────────────────────
echo.
echo  Abrindo dashboard no navegador...

if exist "%~dp0index.html" (
    start "" "%~dp0index.html"
)

:: ─── Iniciar Bot ─────────────────────────────────────────
echo.
echo [4/4] Iniciando o bot...
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

cd /d "%~dp0"
call bun run dev -- --room !ROOM_CODE! --hub !HUB_URL!

echo.
echo  Bot encerrado.
pause

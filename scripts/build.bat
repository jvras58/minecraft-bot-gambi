@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title Minecraft Bot Gambiarra - Build

echo.
echo  ══════════════════════════════════════
echo   Minecraft Bot Gambiarra - Build
echo  ══════════════════════════════════════
echo.

cd /d "%~dp0"

:: ─── Bun ─────────────────────────────────────────────────
where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Bun nao encontrado. Instalando...
    echo.
    powershell -Command "irm bun.sh/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"

    where bun >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  Bun instalado mas precisa reabrir o terminal.
        echo  Feche esta janela e rode build.bat de novo.
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%v in ('bun --version') do echo  Bun v%%v

:: ─── Build ───────────────────────────────────────────────
echo.
echo  Instalando dependencias...
call bun install

echo.
echo  Compilando...
if not exist dist mkdir dist
call bun build --compile src/index.ts --outfile dist/minecraft-bot.exe

if %ERRORLEVEL% neq 0 (
    echo  ERRO na compilacao.
    pause
    exit /b 1
)

echo.
echo  ══════════════════════════════════════
echo   Pronto: dist\minecraft-bot.exe
echo.
echo   Uso:
echo     minecraft-bot.exe --room CODIGO
echo     minecraft-bot.exe --room CODIGO --hub http://host:3000
echo.
echo   Crie um .env ao lado do .exe com:
echo     MINECRAFT_HOST=localhost
echo     MINECRAFT_PORT=25565
echo     BOT_USERNAME=nomeDoBot
echo     BOT_AUTH=offline
echo     Se DESEJAR usar Supabase para salvar logs, adicione:
echo     SUPABASE_URL=xxxxxxxxxx
echo     SUPABASE_ANON_KEY=xxxxxx
echo     SUPABASE_TABLE=xxxxxx
echo  ══════════════════════════════════════
echo.
pause

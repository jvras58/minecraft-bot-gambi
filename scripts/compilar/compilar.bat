@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title Minecraft Bot Gambiarra - Compilar

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     Minecraft Bot Gambiarra - Compilar       ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ─── Verificar Bun ───────────────────────────────────────
where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Bun nao encontrado! Rode iniciar.bat primeiro para instalar.
    pause
    exit /b 1
)

cd /d "%~dp0"

:: ─── Instalar deps ───────────────────────────────────────
echo [1/3] Instalando dependencias...
call bun install
echo.

:: ─── Criar pasta dist ────────────────────────────────────
if not exist dist mkdir dist

:: ─── Compilar ────────────────────────────────────────────
echo [2/3] Compilando executavel Windows...
echo.
call bun build --compile src/index.ts --outfile dist/minecraft-bot.exe

if %ERRORLEVEL% neq 0 (
    echo.
    echo  ERRO: Falha na compilacao.
    pause
    exit /b 1
)

echo.
echo [3/3] Copiando launcher...

:: Copiar o launcher que acompanha o .exe
copy /Y "%~dp0iniciar-standalone.bat" "%~dp0dist\iniciar.bat" >nul 2>&1

echo.
echo  ════════════════════════════════════════════
echo   Compilacao concluida!
echo.
echo   Arquivo: dist\minecraft-bot.exe
echo   Launcher: dist\iniciar.bat
echo.
echo   Para distribuir, envie a pasta dist\ inteira.
echo   A pessoa so precisa rodar iniciar.bat dentro dela.
echo  ════════════════════════════════════════════
echo.
pause

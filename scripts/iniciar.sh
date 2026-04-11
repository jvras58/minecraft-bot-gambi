#!/usr/bin/env bash
#
# Minecraft Bot Gambiarra - Launcher (Linux/Ubuntu)
#
# Pre-requisito: Gambiarra Hub rodando
#
# Uso: chmod +x iniciar.sh && ./iniciar.sh
#

set -e

# ─── Cores ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ─── Diretorio do script ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║     ${BOLD}Minecraft Bot Gambiarra - Launcher${NC}${PURPLE}       ║${NC}"
echo -e "${PURPLE}║                                              ║${NC}"
echo -e "${PURPLE}║  ${YELLOW}Pre-requisito: Gambiarra Hub rodando${NC}${PURPLE}        ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── Verificar se Bun esta instalado ─────────────────────
echo -e "${CYAN}[1/4]${NC} Verificando Bun..."

if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version 2>/dev/null)
    echo -e "  ${GREEN}Bun encontrado: v${BUN_VERSION}${NC}"
else
    echo ""
    echo -e "  ${YELLOW}Bun nao encontrado! Instalando automaticamente...${NC}"
    echo ""

    if command -v curl &> /dev/null; then
        curl -fsSL https://bun.sh/install | bash
    elif command -v wget &> /dev/null; then
        wget -qO- https://bun.sh/install | bash
    else
        echo -e "  ${RED}ERRO: curl ou wget nao encontrados.${NC}"
        echo -e "  Instale o Bun manualmente: ${BLUE}https://bun.sh/docs/installation${NC}"
        exit 1
    fi

    # Carregar Bun no PATH da sessao atual
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    # Tambem tenta source do profile
    [ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc" 2>/dev/null || true
    [ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null || true

    if ! command -v bun &> /dev/null; then
        echo ""
        echo -e "  ${RED}Bun instalado, mas nao encontrado no PATH.${NC}"
        echo -e "  Feche o terminal, abra novamente e rode: ${BOLD}./iniciar.sh${NC}"
        exit 1
    fi

    echo ""
    echo -e "  ${GREEN}Bun instalado com sucesso!${NC}"
fi

# ─── Instalar dependencias ───────────────────────────────
echo ""
echo -e "${CYAN}[2/4]${NC} Instalando dependencias..."
echo ""

bun install

echo ""
echo -e "  ${GREEN}Dependencias instaladas!${NC}"

# ─── Configuracao ─────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/4]${NC} Configuracao"
echo ""
echo -e "  ${PURPLE}════════════════════════════════════════════${NC}"

# Room Code
read -rp "  Room Code do Gambiarra (obrigatorio): " ROOM_CODE

if [ -z "$ROOM_CODE" ]; then
    echo ""
    echo -e "  ${RED}ERRO: Room Code e obrigatorio!${NC}"
    exit 1
fi

# Hub URL
read -rp "  Hub URL [http://localhost:3000]: " HUB_URL
HUB_URL="${HUB_URL:-http://localhost:3000}"

# Minecraft Server
read -rp "  Minecraft Host [localhost]: " MC_HOST
MC_HOST="${MC_HOST:-localhost}"

read -rp "  Minecraft Porta [25565]: " MC_PORT
MC_PORT="${MC_PORT:-25565}"

read -rp "  Nome do Bot [BotGambiarra]: " BOT_NAME
BOT_NAME="${BOT_NAME:-BotGambiarra}"

# ─── Criar/Atualizar .env ────────────────────────────────
echo ""
echo -e "  Salvando configuracao no .env..."

cat > "$SCRIPT_DIR/.env" << EOF
# Gerado por iniciar.sh
GAMBIARRA_HUB_URL=${HUB_URL}
GAMBIARRA_MODEL=*
MINECRAFT_HOST=${MC_HOST}
MINECRAFT_PORT=${MC_PORT}
BOT_USERNAME=${BOT_NAME}
BOT_AUTH=offline
EOF

echo -e "  ${GREEN}.env atualizado!${NC}"

# ─── Abrir Dashboard ─────────────────────────────────────
echo ""
echo -e "  Abrindo dashboard no navegador..."

if [ -f "$SCRIPT_DIR/index.html" ]; then
    # Detectar comando de abrir navegador
    if command -v xdg-open &> /dev/null; then
        xdg-open "$SCRIPT_DIR/index.html" 2>/dev/null &
    elif command -v open &> /dev/null; then
        open "$SCRIPT_DIR/index.html" 2>/dev/null &
    elif command -v wslview &> /dev/null; then
        wslview "$SCRIPT_DIR/index.html" 2>/dev/null &
    else
        echo -e "  ${YELLOW}Abra manualmente: file://${SCRIPT_DIR}/index.html${NC}"
    fi
fi

# ─── Iniciar Bot ──────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/4]${NC} Iniciando o bot..."
echo ""
echo -e "  ${PURPLE}════════════════════════════════════════════${NC}"
echo -e "   Room:     ${BOLD}${ROOM_CODE}${NC}"
echo -e "   Hub:      ${BOLD}${HUB_URL}${NC}"
echo -e "   Server:   ${BOLD}${MC_HOST}:${MC_PORT}${NC}"
echo -e "   Bot:      ${BOLD}${BOT_NAME}${NC}"
echo -e "  ${PURPLE}════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Pressione Ctrl+C para parar o bot.${NC}"
echo ""

cd "$SCRIPT_DIR"
bun run dev -- --room "$ROOM_CODE" --hub "$HUB_URL"

echo ""
echo -e "  ${RED}Bot encerrado.${NC}"

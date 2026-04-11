#!/usr/bin/env bash
#
# Minecraft Bot Gambiarra - Launcher Standalone
#
# Uso: chmod +x iniciar.sh && ./iniciar.sh
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║       ${BOLD}Minecraft Bot Gambiarra${NC}${PURPLE}                ║${NC}"
echo -e "${PURPLE}║                                              ║${NC}"
echo -e "${PURPLE}║  ${YELLOW}Pre-requisito: Gambiarra Hub rodando${NC}${PURPLE}        ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Verificar executavel
if [ ! -f "$SCRIPT_DIR/minecraft-bot" ]; then
    echo -e "${RED}ERRO: minecraft-bot nao encontrado nesta pasta!${NC}"
    exit 1
fi

# ─── Configuracao ─────────────────────────────────────────
echo -e "  ${PURPLE}Configuracao${NC}"
echo -e "  ${PURPLE}════════════════════════════════════════════${NC}"

read -rp "  Room Code do Gambiarra (obrigatorio): " ROOM_CODE

if [ -z "$ROOM_CODE" ]; then
    echo ""
    echo -e "  ${RED}ERRO: Room Code e obrigatorio!${NC}"
    exit 1
fi

read -rp "  Hub URL [http://localhost:3000]: " HUB_URL
HUB_URL="${HUB_URL:-http://localhost:3000}"

read -rp "  Minecraft Host [localhost]: " MC_HOST
MC_HOST="${MC_HOST:-localhost}"

read -rp "  Minecraft Porta [25565]: " MC_PORT
MC_PORT="${MC_PORT:-25565}"

read -rp "  Nome do Bot [BotGambiarra]: " BOT_NAME
BOT_NAME="${BOT_NAME:-BotGambiarra}"

# ─── Criar .env ───────────────────────────────────────────
cat > "$SCRIPT_DIR/.env" << EOF
GAMBIARRA_HUB_URL=${HUB_URL}
GAMBIARRA_MODEL=*
MINECRAFT_HOST=${MC_HOST}
MINECRAFT_PORT=${MC_PORT}
BOT_USERNAME=${BOT_NAME}
BOT_AUTH=offline
EOF

# ─── Iniciar ──────────────────────────────────────────────
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

"$SCRIPT_DIR/minecraft-bot" --room "$ROOM_CODE" --hub "$HUB_URL"

echo ""
echo -e "  ${RED}Bot encerrado.${NC}"

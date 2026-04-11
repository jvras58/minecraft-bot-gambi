#!/usr/bin/env bash
#
# Minecraft Bot Gambiarra - Compilar executavel standalone
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║     ${BOLD}Minecraft Bot Gambiarra - Compilar${NC}${PURPLE}       ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── Verificar Bun ────────────────────────────────────────
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Bun nao encontrado! Rode ./iniciar.sh primeiro para instalar.${NC}"
    exit 1
fi

# ─── Instalar deps ────────────────────────────────────────
echo -e "${CYAN}[1/3]${NC} Instalando dependencias..."
bun install
echo ""

# ─── Criar pasta dist ─────────────────────────────────────
mkdir -p dist

# ─── Compilar ─────────────────────────────────────────────
echo -e "${CYAN}[2/3]${NC} Compilando executavel Linux..."
echo ""
bun build --compile src/index.ts --outfile dist/minecraft-bot

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}ERRO: Falha na compilacao.${NC}"
    exit 1
fi

chmod +x dist/minecraft-bot

# ─── Copiar launcher ──────────────────────────────────────
echo ""
echo -e "${CYAN}[3/3]${NC} Copiando launcher..."

cp "$SCRIPT_DIR/iniciar-standalone.sh" "$SCRIPT_DIR/dist/iniciar.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/dist/iniciar.sh" 2>/dev/null || true

echo ""
echo -e "  ${PURPLE}════════════════════════════════════════════${NC}"
echo -e "   ${GREEN}Compilacao concluida!${NC}"
echo ""
echo -e "   Arquivo:  ${BOLD}dist/minecraft-bot${NC}"
echo -e "   Launcher: ${BOLD}dist/iniciar.sh${NC}"
echo ""
echo -e "   Para distribuir, envie a pasta dist/ inteira."
echo -e "   A pessoa so precisa rodar ./iniciar.sh dentro dela."
echo -e "  ${PURPLE}════════════════════════════════════════════${NC}"
echo ""

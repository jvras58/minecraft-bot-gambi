#!/usr/bin/env bash
set -e

cd "$(dirname "${BASH_SOURCE[0]}")"

echo ""
echo "  ══════════════════════════════════════"
echo "   Minecraft Bot Gambiarra - Build"
echo "  ══════════════════════════════════════"
echo ""

# ─── Bun ──────────────────────────────────────────────────
if ! command -v bun &> /dev/null; then
    echo "  Bun nao encontrado. Instalando..."
    echo ""
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if ! command -v bun &> /dev/null; then
        echo ""
        echo "  Bun instalado mas precisa reabrir o terminal."
        echo "  Feche e rode ./build.sh de novo."
        exit 1
    fi
fi

echo "  Bun v$(bun --version)"

# ─── Build ────────────────────────────────────────────────
echo ""
echo "  Instalando dependencias..."
bun install

echo ""
echo "  Compilando..."
mkdir -p dist
bun build --compile src/index.ts --outfile dist/minecraft-bot
chmod +x dist/minecraft-bot

echo ""
echo "  ══════════════════════════════════════"
echo "   Pronto: dist/minecraft-bot"
echo ""
echo "   Uso:"
echo "     ./minecraft-bot --room CODIGO"
echo "     ./minecraft-bot --room CODIGO --hub http://host:3000"
echo ""
echo "   Crie um .env ao lado do binario com:"
echo "     MINECRAFT_HOST=localhost"
echo "     MINECRAFT_PORT=25565"
echo "     BOT_USERNAME=BotGambiarra"
echo "     BOT_AUTH=offline"
echo "  ══════════════════════════════════════"
echo ""

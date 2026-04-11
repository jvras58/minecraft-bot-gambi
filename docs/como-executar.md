# Como Executar o Bot

## Pre-requisitos

- **Gambiarra Hub** rodando com pelo menos 1 participante na sala
- **Servidor Minecraft Java** acessivel

## Compilar

O script verifica se o Bun esta instalado, instala se precisar, e compila o executavel.

**Windows:** duplo-clique em `build.bat`

**Linux:**
```bash
chmod +x build.sh
./build.sh
```

O executavel e gerado em `dist/minecraft-bot` (ou `dist/minecraft-bot.exe` no Windows).

## Rodar

```bash
# minimo (usa localhost:3000 como hub)
./minecraft-bot --room SEU_ROOM_CODE

# com hub customizado
./minecraft-bot --room SEU_ROOM_CODE --hub http://192.168.1.10:3000
```

Crie um `.env` ao lado do executavel para configurar o servidor Minecraft:

```env
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
BOT_USERNAME=BotGambiarra
BOT_AUTH=offline
```

`Ctrl+C` para parar o bot.

## Cross-compilation

Compile para outra plataforma a partir da sua:

```bash
bun run build:win    # gera dist/minecraft-bot.exe
bun run build:linux  # gera dist/minecraft-bot
```

## Solucao de problemas

| Problema | Solucao |
|----------|---------|
| "Bun nao encontrado" apos instalar | Feche e abra o terminal, rode o build de novo |
| Erro de conexao com o Hub | Verifique se o Gambiarra Hub esta rodando |
| Bot nao entra no servidor | Confira host, porta e se o servidor aceita bots offline |
| Timeout nas respostas | Verifique se ha participantes online na sala |

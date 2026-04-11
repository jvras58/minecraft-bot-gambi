# Como Executar o Bot

Guia rapido para rodar o Minecraft Bot Gambiarra.

## Pre-requisitos

- **Gambiarra Hub** rodando com pelo menos 1 participante na sala
- **Servidor Minecraft Java** acessivel (local ou remoto)

---

## Opcao 1: Executavel Standalone (sem instalar nada)

Alguem ja compilou o bot pra voce. Voce recebe uma pasta `dist/` com:

```
dist/
  minecraft-bot.exe   (Windows) ou minecraft-bot (Linux)
  iniciar.bat         (Windows) ou iniciar.sh   (Linux)
```

### Windows

Duplo-clique em `iniciar.bat`. Ele vai perguntar:

- **Room Code** — codigo da sala no Gambiarra Hub (obrigatorio)
- **Hub URL** — endereco do hub (padrao: `http://localhost:3000`)
- **Minecraft Host** — IP do servidor (padrao: `localhost`)
- **Minecraft Porta** — porta do servidor (padrao: `25565`)
- **Nome do Bot** — nome no jogo (padrao: `BotGambiarra`)

Pronto. O bot inicia. `Ctrl+C` para parar.

### Linux

```bash
chmod +x iniciar.sh
./iniciar.sh
```

Mesmas perguntas, mesmo fluxo.

### Uso direto (sem launcher)

```bash
# Windows
minecraft-bot.exe --room SEU_ROOM_CODE --hub http://localhost:3000

# Linux
./minecraft-bot --room SEU_ROOM_CODE --hub http://localhost:3000
```

As configuracoes de servidor Minecraft ficam no `.env` ao lado do executavel:

```env
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
BOT_USERNAME=BotGambiarra
BOT_AUTH=offline
```

---

## Opcao 2: Rodar do codigo-fonte (com Bun)

Se voce quer modificar o bot ou nao tem o executavel compilado.

### Windows

Duplo-clique em `iniciar.bat` na raiz do projeto. Ele:

1. Instala o Bun automaticamente (se necessario)
2. Roda `bun install`
3. Pergunta as configuracoes
4. Inicia o bot

### Linux

```bash
chmod +x iniciar.sh
./iniciar.sh
```

### Manual

```bash
bun install
bun run dev -- --room SEU_ROOM_CODE
bun run dev -- --room SEU_ROOM_CODE --hub http://outro-host:3000
```

---

## Compilar o executavel (para distribuir)

Voce precisa do Bun instalado para compilar. O resultado e um binario unico que nao precisa de Bun pra rodar.

### Windows

Duplo-clique em `compilar.bat` ou rode:

```bash
bun install
bun run build:win
```

Gera: `dist/minecraft-bot.exe`

### Linux

```bash
chmod +x compilar.sh
./compilar.sh
```

Ou manualmente:

```bash
bun install
bun run build:linux
```

Gera: `dist/minecraft-bot`

### Cross-compilation

Voce pode compilar pra outro sistema a partir do seu:

```bash
# No Linux, compilar pra Windows:
bun run build:win

# No Windows, compilar pra Linux:
bun run build:linux
```

Depois distribua a pasta `dist/` — ela contem o executavel + launcher.

---

## Solucao de problemas

| Problema | Solucao |
|----------|---------|
| "Bun nao encontrado" apos instalar | Feche e abra o terminal novamente |
| Erro de conexao com o Hub | Verifique se o Gambiarra Hub esta rodando |
| Bot nao entra no servidor | Confira host, porta e se o servidor aceita bots offline |
| Timeout nas respostas | Verifique se ha participantes online na sala |
| Compilacao falha | Rode `bun install` antes de compilar |

# Como Executar o Bot

## Pre-requisitos

- **Gambiarra Hub** rodando com pelo menos 1 participante na sala
- **Servidor Minecraft Java** acessivel

## Compilar

O script verifica se o Bun esta instalado, instala se precisar, e gera o executavel.

**Windows:** duplo-clique em `scripts/build.bat`

**Linux:**
```bash
chmod +x scripts/build.sh
./scripts/build.sh
```

Ao final voce tera a pasta `dist/` com:

```
dist/
  minecraft-bot.exe   (Windows) ou minecraft-bot (Linux)
  .env                (configuracao do servidor Minecraft)
```

## Rodar

Abra um terminal na pasta `dist/` e rode:

```bash
# Windows
minecraft-bot.exe --room SEU_ROOM_CODE

# Linux
./minecraft-bot --room SEU_ROOM_CODE
```

Para usar um hub em outro endereco:

```bash
minecraft-bot.exe --room SEU_ROOM_CODE --hub http://192.168.1.10:3000
```

`Ctrl+C` para parar.

## Configuracao do Minecraft

Edite o `.env` dentro de `dist/` antes de rodar:

```env
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
BOT_USERNAME=BotGambiarra
BOT_AUTH=offline
```

Para salvar logs no Supabase (opcional), adicione:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave
SUPABASE_TABLE=bot_cycles
```

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

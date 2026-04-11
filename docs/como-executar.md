# Como Executar o Bot

Guia rapido para rodar o Minecraft Bot Gambiarra sem instalar nada manualmente.

## Pre-requisitos

- **Gambiarra Hub** rodando com pelo menos 1 participante na sala
- **Servidor Minecraft Java** acessivel (local ou remoto)
- Conexao com internet (para instalar Bun na primeira vez)

## Windows

Duplo-clique no arquivo `iniciar.bat` na raiz do projeto.

O script vai:

1. Verificar se o Bun esta instalado (se nao, instala automaticamente)
2. Instalar as dependencias do projeto (`bun install`)
3. Perguntar as configuracoes:
   - **Room Code** — codigo da sala no Gambiarra Hub (obrigatorio)
   - **Hub URL** — endereco do hub (padrao: `http://localhost:3000`)
   - **Minecraft Host** — IP/endereco do servidor (padrao: `localhost`)
   - **Minecraft Porta** — porta do servidor (padrao: `25565`)
   - **Nome do Bot** — nome que aparece no jogo (padrao: `BotGambiarra`)
4. Salvar tudo no `.env`
5. Iniciar o bot

Para parar o bot, pressione `Ctrl+C` na janela do terminal.

## Linux / Ubuntu

Abra o terminal na pasta do projeto e execute:

```bash
chmod +x iniciar.sh
./iniciar.sh
```

O fluxo e o mesmo do Windows: verifica Bun, instala dependencias, pergunta configuracoes e inicia o bot.

### Observacoes para Linux

- O Bun e instalado via `curl` (ou `wget` se curl nao estiver disponivel)
- Caso o Bun nao seja encontrado no PATH apos a instalacao, feche o terminal, abra novamente e rode `./iniciar.sh` de novo

## Execucao manual (se preferir)

Se voce ja tem o Bun instalado e quer pular o launcher:

```bash
bun install
bun run dev -- --room SEU_ROOM_CODE
```

Opcoes extras:

```bash
bun run dev -- --room SEU_ROOM_CODE --hub http://outro-host:3000
```

## Solucao de problemas

| Problema | Solucao |
|----------|---------|
| "Bun nao encontrado" apos instalar | Feche e abra o terminal novamente |
| Erro de conexao com o Hub | Verifique se o Gambiarra Hub esta rodando |
| Bot nao entra no servidor | Confira host, porta e se o servidor aceita bots offline |
| Timeout nas respostas | Verifique se ha participantes online na sala do Gambiarra |

# 🤖 Minecraft Bot com IA (via Gambi)

Bot autônomo de Minecraft que usa a sdk**Gambi** como Host de LLM. o bot usa os LLMs compartilhados por participantes em uma sala fornecida pela Gambi.

## Como Funciona

```

│  Minecraft   │────▶│   Minecraft Bot │────▶│  Gambiarra Hub  │
│   Server     │◀────│   (este app)    │◀────│   (sala LLM)    │

                                                       │
                                                       ▼
                                              │  Participantes  │
                                              │  (Ollama, LM    │
                                              │   Studio, etc.) │
```

O bot:
1. **Percebe** o mundo (vida, fome, entidades, blocos, inventário)
2. **Raciocina** enviando contexto ao hub Gambiarra via API OpenAI-compatible
3. **Age** executando a decisão do LLM (andar, falar, coletar, atacar, etc.)
4. **Memoriza** as últimas 15 ações para evitar loops

## Pré-requisitos

- **Bun** (runtime)
- **Servidor Minecraft** Java Edition rodando (PAPER)
- **Hub Gambiarra** rodando com pelo menos um participante LLM na sala

## Setup

### 1. Garanta que o hub Gambiarra está rodando

```bash
# Em um terminal
gambi serve --port 3000

# Em outro terminal
gambi create --name "Minecraft AI"
# → Room code: ABC123

# Alguém (ou você) entra com um LLM
gambi join --code ABC123 --model llama3 --endpoint http://localhost:11434
```

### 2. Configure o Minecraft (opcional)

```bash
cp .env.example .env
```

Edite o `.env` se o servidor Minecraft não estiver em localhost:

```env
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
BOT_USERNAME=AgenteBot
BOT_AUTH=offline
```

### 3. Execute

```bash
# Passe o room code via --room
bun run dev -- --room ABC123

# Ou com opções extras
bun run dev -- --room ABC123 --hub http://192.168.1.10:3000 --model llama3

# Ver ajuda
bun run dev -- --help
```

## CLI

```
bun run dev -- --room <ROOM_CODE> [opções]

Opções:
  --room, -r <code>    Código da sala Gambiarra (obrigatório)
  --hub <url>          URL do hub (default: http://localhost:3000)
  --model <model>      Modelo a usar, "*" = qualquer (default: *)
  --help, -h           Mostra ajuda
```

## Configuração

O room code vem via CLI. O resto pode ser configurado via `.env` ou CLI args (CLI tem prioridade):

| Origem | Variável / Flag | Descrição | Default |
|--------|-----------------|-----------|---------|
| CLI | `--room` | Código da sala | (obrigatório) |
| CLI | `--hub` | URL do hub | `http://localhost:3000` |
| CLI | `--model` | Modelo a usar | `*` |
| .env | `GAMBIARRA_HUB_URL` | Fallback para --hub | `http://localhost:3000` |
| .env | `GAMBIARRA_MODEL` | Fallback para --model | `*` |
| .env | `MINECRAFT_HOST` | Host do servidor Minecraft | `localhost` |
| .env | `MINECRAFT_PORT` | Porta do servidor | `25565` |
| .env | `BOT_USERNAME` | Nome do bot no jogo | `AgenteBot` |
| .env | `BOT_AUTH` | Tipo de autenticação | `offline` |

## Arquitetura

```
src/
├── index.ts              # Bootstrap
├── config/
│   └── settings.ts       # Configurações (Gambiarra + Minecraft)
├── bot/                   # Camada Minecraft (Mineflayer)
│   ├── ActionExecutor.ts  # Executa ações (FALAR, ANDAR, SEGUIR, etc.)
│   ├── BotManager.ts      # Conexão e eventos do bot
│   ├── MovementManager.ts # Controle de movimento
│   └── PerceptionManager.ts # Percepção rica do ambiente
├── core/                  # Lógica principal
│   ├── AgentLoop.ts       # Loop: Percepção → Raciocínio → Ação
│   └── MemoryManager.ts   # Memória de curto prazo (ring buffer)
├── llm/
│   └── GambiarraLLM.ts    # Cliente LLM via hub Gambiarra
├── prompts/
│   └── botPrompts.ts      # Prompts com chain-of-thought
├── schemas/
│   └── botAction.ts       # Schema Zod das ações
├── types/
│   └── types.ts           # Interfaces TypeScript
└── utils/
    ├── jsonParser.ts      # Parse resiliente com jsonrepair
    └── sleep.ts
```

## Ações Disponíveis

| Ação | Descrição |
|------|-----------|
| `FALAR` | Envia mensagem no chat |
| `ANDAR` | Move em uma direção |
| `EXPLORAR` | Movimento aleatório |
| `PULAR` | Faz o bot pular |
| `OLHAR` | Olha para jogadores próximos |
| `PARAR` | Para qualquer movimento |
| `SEGUIR` | Segue um jogador |
| `FUGIR` | Corre de uma entidade |
| `COLETAR` | Minera/coleta bloco próximo |
| `ATACAR` | Ataca entidade próxima |
| `NADA` | Apenas observa |

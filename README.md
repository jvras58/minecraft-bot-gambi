# 🤖 Minecraft Bot — Benchmark Fan-out (via Gambi)

Bot autônomo de Minecraft que usa o **Gambi** como hub de LLMs para benchmark comparativo. A cada ciclo de decisão, o bot envia o **mesmo prompt para TODOS os participantes** da sala em paralelo, coleta todas as respostas, executa a mais rápida e loga tudo no Supabase para análise.

## Como Funciona

```
┌──────────────┐      ┌──────────────────┐       ┌─────────────────┐
│  Minecraft   │◄────▶│  Minecraft Bot   │◄────▶│   Gambi Hub     │
│   Server     │      │  (este app)      │       │   (sala LLM)    │
└──────────────┘      └──────────────────┘       └────────┬────────┘
                              │                          │
                              │                    ┌─────┴──────┐
                              │               ┌────┤  Fan-out   ├────┐
                              ▼               ▼    └────────────┘    ▼
                      ┌──────────────┐  ┌──────────┐          ┌──────────┐
                      │   Supabase   │  │ Máquina A│          │ Máquina B│
                      │  (métricas)  │  │ llama3   │   ...    │ mistral  │
                      └──────────────┘  │          │          │ GTX 1080 │
                                        └──────────┘          └──────────┘
```

O bot a cada ciclo (~3s):
1. **Percebe** o mundo (vida, fome, entidades, blocos, inventário)
2. **Monta o prompt** uma única vez (system + contexto + memória)
3. **Fan-out** — envia o mesmo prompt para todos os participantes em paralelo
4. **Parseia** todas as respostas (JSON + validação Zod)
5. **Seleciona** a resposta válida mais rápida
6. **Executa** a ação no Minecraft
7. **Loga** todas as respostas no Supabase (uma linha por participante por ciclo)

## Pré-requisitos

- **Bun** (runtime)
- **Servidor Minecraft** Java Edition (Paper MC recomendado)
- **Gambi Hub** rodando com 2+ participantes LLM na sala
- **Supabase** (opcional, para coleta de dados)

## Setup

### 1. Hub Gambi + Participantes

```bash
# Terminal 1 — iniciar o hub
gambi serve --port 3000

# Terminal 2 — criar sala
gambi create --name "Benchmark AI"
# → Room code: ABC123

# Cada pessoa com LLM entra na sala:
# Máquina A
gambi join --code ABC123 --model llama3

# Máquina B
gambi join --code ABC123 --model mistral --endpoint http://localhost:1234

# Máquina C
gambi join --code ABC123 --model qwen2
```

O `gambi join` compartilha automaticamente as specs da máquina (CPU, RAM, GPU).

### 2. Supabase (para coleta de dados)

```bash
# Crie um projeto em supabase.com
# No SQL Editor, execute o conteúdo de supabase/schema.sql
# Copie a URL e a anon key
```

### 3. Configure e execute

```bash
cp .env.example .env
# Edite .env com SUPABASE_URL e SUPABASE_ANON_KEY

bun install
bun run dev -- --room ABC123
```

## CLI

```
bun run dev -- --room <ROOM_CODE> [opções]

Opções:
  --room, -r <code>    Código da sala Gambi (obrigatório)
  --hub <url>          URL do hub (default: http://localhost:3000)
  --help, -h           Mostra ajuda
```

Não é necessário `--model` — o bot envia para **todos** os participantes automaticamente.

## Configuração

| Origem | Variável / Flag | Descrição | Default |
|--------|-----------------|-----------|---------|
| CLI | `--room` | Código da sala | (obrigatório) |
| CLI | `--hub` | URL do hub | `http://localhost:3000` |
| .env | `SUPABASE_URL` | URL do Supabase | (desativado) |
| .env | `SUPABASE_ANON_KEY` | Chave anônima | (desativado) |
| .env | `MINECRAFT_HOST` | Host do servidor | `localhost` |
| .env | `MINECRAFT_PORT` | Porta do servidor | `25565` |
| .env | `BOT_USERNAME` | Nome do bot | `AgenteBot` |

## Banco de Dados (Supabase)

### 3 tabelas

| Tabela | Descrição |
|--------|-----------|
| `sessions` | Metadados de cada sessão de benchmark |
| `participant_snapshots` | Specs de hardware de cada máquina (CPU, RAM, GPU, VRAM, OS) |
| `cycle_responses` | Uma linha por participante por ciclo — latência, ação, se foi executada |

### Views de análise

| View | Descrição |
|------|-----------|
| `v_latency_by_setup` | Latência média/p50/p95 por modelo × GPU |
| `v_fastest_per_cycle` | Qual setup teve menor latência em cada ciclo |

## Arquitetura

```
src/
├── index.ts                  # Bootstrap (modo fan-out)
├── config/
│   └── settings.ts           # Configurações (Gambi + Minecraft + Benchmark)
├── bot/                      # Camada Minecraft (Mineflayer)
│   ├── ActionExecutor.ts     # Executa ações (FALAR, ANDAR, SEGUIR, etc.)
│   ├── BotManager.ts         # Conexão e eventos do bot
│   ├── MovementManager.ts    # Controle de movimento
│   └── PerceptionManager.ts  # Percepção do ambiente
├── core/                     # Lógica principal
│   ├── AgentLoop.ts          # Loop fan-out: prompt → todos → seleciona → executa
│   ├── MemoryManager.ts      # Memória de curto prazo (ring buffer)
│   └── DataLogger.ts         # Envia métricas para Supabase (3 tabelas)
├── llm/
│   └── GambiarraLLM.ts       # Cliente LLM com invokeAll() para fan-out
├── prompts/
│   └── botPrompts.ts         # System prompt + template
├── schemas/
│   └── botAction.ts          # Schema Zod das ações
├── types/
│   ├── types.ts              # Interfaces TypeScript
│   └── gambi-sdk.d.ts        # Tipos do SDK Gambi
└── utils/
    ├── args.ts               # Parser CLI
    ├── jsonParser.ts          # Parse + reparo de JSON
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

## Saída do Terminal

```
🤖 Minecraft Bot — Benchmark Fan-out

   Sala: ABC123
   Hub:  http://localhost:3000
   Modo: fan-out (todos os participantes)

🖥️  Participantes online (3):
   joao — llama3 (GPU: NVIDIA RTX 4090, RAM: 32GB)
   maria — mistral (GPU: NVIDIA GTX 1080, RAM: 16GB)
   pedro — qwen2 (GPU: Apple M2 Pro, RAM: 16GB)

━━━ Ciclo #1 (3 participantes) ━━━
📡 Enviando prompt para todos os participantes...
   joao [llama3]: ✅ EXPLORAR (842ms)
   maria [mistral]: ✅ ANDAR (1203ms)
   pedro [qwen2]: ✅ COLETAR (956ms)
🏆 Selecionado: joao [llama3] — EXPLORAR (842ms)
💭 Raciocínio: Estou num lugar novo, vou explorar para encontrar recursos
```
# Arquitetura — Minecraft Bot Benchmark Fan-out via Gambi

## Visão Geral

O projeto é um **bot autônomo de Minecraft** que usa LLMs para tomar decisões em tempo real, operando em **modo fan-out benchmark**: a cada ciclo, o bot envia o **mesmo prompt para TODOS os participantes** de uma sala Gambi em paralelo, coleta todas as respostas, executa uma delas e loga tudo no Supabase.

O objetivo é produzir dados pareados para comparação direta de modelos e hardware — mesmo prompt, mesmo instante, mesmo contexto de jogo, respostas diferentes.

O bot se conecta ao **Gambi** — um hub open-source que interliga LLMs em rede local — para acessar modelos rodando nas máquinas dos participantes. O Gambi é um proxy transparente: não gera prompts, não faz inferência, apenas redireciona requisições.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        VISÃO GERAL DO SISTEMA                       │
│                                                                      │
│                     ┌──────────────────────┐                         │
│                     │    Minecraft Bot     │                         │
│                     │    (este projeto)    │                         │
│                     │                      │                         │
│                     │  Prompt montado      │                         │
│                     │  LOCALMENTE          │                         │
│                     │  (botPrompts.ts)     │                         │
│                     └──────────┬───────────┘                         │
│                                │                                     │
│              ┌─────────────────┼─────────────────┐                   │
│              │   MESMO PROMPT  │  PARA TODOS     │                   │
│              ▼                 ▼                  ▼                   │
│  ┌───────────────────────────────────────────────────────┐           │
│  │                  GAMBI HUB (HTTP)                     │           │
│  │                                                       │           │
│  │  Sala: ABC123                                         │           │
│  │  ┌─────────────────────────────────────────────────┐  │           │
│  │  │ joao  → llama3  @ 192.168.1.50:11434 (RTX 4090)│  │           │
│  │  │ maria → mistral @ 192.168.1.51:1234  (GTX 1080)│  │           │
│  │  │ pedro → qwen2   @ 192.168.1.52:11434 (M2 Pro)  │  │           │
│  │  └─────────────────────────────────────────────────┘  │           │
│  └───────────────────────────────────────────────────────┘           │
│              │                 │                  │                   │
│              ▼                 ▼                  ▼                   │
│       ┌──────────┐     ┌──────────┐       ┌──────────┐              │
│       │  Ollama  │     │ LM Studio│       │  Ollama  │              │
│       │  llama3  │     │  mistral │       │  qwen2   │              │
│       │ RTX 4090 │     │ GTX 1080 │       │  M2 Pro  │              │
│       └──────────┘     └──────────┘       └──────────┘              │
│                                                                      │
│              TODAS as respostas voltam para o bot                    │
│                         │                                            │
│                         ▼                                            │
│              ┌──────────────────────┐                                │
│              │      Supabase        │                                │
│              │  sessions            │                                │
│              │  participant_snapshots│                                │
│              │  cycle_responses     │                                │
│              └──────────────────────┘                                │
│                                                                      │
│              ┌──────────────────────┐                                │
│              │  Servidor Minecraft  │                                │
│              │  Paper MC (Java Ed.) │                                │
│              └──────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Bot Minecraft (este repositório)

Aplicação TypeScript/Bun que se conecta a:

- **Servidor Minecraft** via Mineflayer (protocolo nativo)
- **Gambi Hub** via SDK (HTTP REST, API compatível com OpenAI)

O bot **não** roda nenhum LLM. Os prompts são definidos localmente em `botPrompts.ts` e enviados a cada ciclo via SDK. A inferência acontece nas máquinas dos participantes.

### 2. Gambi Hub

Servidor HTTP central que gerencia salas e redireciona requisições LLM. O hub **não** processa inferência e **não** gera prompts — é um proxy transparente que:

- Mantém registro de quais máquinas estão online e quais modelos oferecem
- Quando o bot faz uma requisição via `gambi.participant(id)`, redireciona para o endpoint daquela máquina
- Retorna a resposta sem modificar o conteúdo

### 3. Gambi SDK

Provider do Vercel AI SDK. O bot usa dois métodos principais:

```typescript
// Listar participantes com specs de hardware
const participants = await gambi.listParticipants();
// → [{ id, nickname, model, status, specs: { cpu, ram, gpu, vram, os } }]

// Enviar prompt para um participante específico
const result = await generateText({
  model: gambi.participant("joao"),
  system: systemPrompt,
  messages: [...],
});
```

### 4. Supabase (Coleta de Dados)

Banco Postgres online com 3 tabelas:

| Tabela | Descrição | Quando insere |
|--------|-----------|---------------|
| `sessions` | Metadados da sessão (room, bot, duração) | Uma vez no início |
| `participant_snapshots` | Specs de cada máquina (CPU, RAM, GPU, VRAM, OS) | Uma vez no início |
| `cycle_responses` | Uma linha por participante por ciclo | A cada ciclo (~3s) |

Configuração opcional — sem as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`, o bot funciona normalmente sem coletar dados.

---

## Ciclo de Decisão (AgentLoop — modo fan-out)

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTLOOP — FAN-OUT (3s cycle)                │
│                                                                  │
│  ┌──────────────┐                                                │
│  │ 1. PERCEPÇÃO │  PerceptionManager.getGameContext()            │
│  │              │  → vida, fome, posição, entidades,             │
│  │              │    blocos, inventário, bioma, clima            │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 2. MEMÓRIA   │  MemoryManager.toPromptString()                │
│  │              │  → últimos 15 eventos (ring buffer)            │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 3. PROMPT    │  Montado UMA vez (system + contexto + memória) │
│  │              │  Prompts definidos em botPrompts.ts (local)    │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐   │
│  │ 4. FAN-OUT   │  │ Promise.all([                           │   │
│  │              │  │   generateText({ model: participant A })│   │
│  │  MESMO       │  │   generateText({ model: participant B })│   │
│  │  PROMPT      │  │   generateText({ model: participant C })│   │
│  │  PARA TODOS  │  │ ])                                      │   │
│  │              │  │ → N respostas em paralelo               │   │
│  └──────┬───────┘  └─────────────────────────────────────────┘   │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 5. PARSE     │  Para CADA resposta:                           │
│  │              │  safeParseJSON() + botActionSchema.parse()     │
│  │              │  → N ações validadas (ou erros)                │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 6. SELEÇÃO   │  Escolhe a resposta válida mais rápida        │
│  │              │  (estratégia configurável: fastest | random)   │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 7. EXECUÇÃO  │  ActionExecutor.executar(ação selecionada)     │
│  │              │  → mineflayer: andar, falar, coletar...        │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 8. LOG       │  DataLogger.log(TODAS as respostas)            │
│  │              │  → N linhas no Supabase (1 por participante)  │
│  │              │  → was_executed = true só na selecionada       │
│  └──────────────┘                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Diferença para o modo anterior

| Aspecto | Antes (sessões separadas) | Agora (fan-out) |
|---------|---------------------------|-----------------|
| Prompt | Enviado para 1 participante | Enviado para TODOS em paralelo |
| Comparação | Entre sessões diferentes | Dentro do mesmo ciclo |
| Contexto do jogo | Diferente por sessão | Idêntico para todos |
| Dados por ciclo | 1 linha no banco | N linhas (1 por participante) |
| Análise estatística | Amostras independentes | Dados pareados |
| Specs da máquina | Registradas manualmente | Capturadas automaticamente |

---

## Fluxo de Comunicação — Fan-out

```
Bot                      Gambi Hub              Máquina A        Máquina B        Máquina C
 │                          │                      │                │                │
 │  listParticipants()      │                      │                │                │
 │ ────────────────────────►│                      │                │                │
 │  ◄── [{joao, maria, pedro}]                    │                │                │
 │                          │                      │                │                │
 │  POST participant:joao   │                      │                │                │
 │ ────────────────────────►│  forward ───────────►│                │                │
 │                          │                      │                │                │
 │  POST participant:maria  │                      │                │                │
 │ ────────────────────────►│  forward ────────────────────────────►│                │
 │                          │                      │                │                │
 │  POST participant:pedro  │                      │                │                │
 │ ────────────────────────►│  forward ───────────────────────────────────────────►  │
 │                          │                      │                │                │
 │                          │  ◄── resposta A (842ms)               │                │
 │  ◄── resposta A ─────────│                      │                │                │
 │                          │                      │  ◄── resposta B (1203ms)        │
 │  ◄── resposta B ─────────│                      │                │                │
 │                          │                      │                │  ◄── resp C (956ms)
 │  ◄── resposta C ─────────│                      │                │                │
 │                          │                      │                │                │
 │  Seleciona A (mais rápida)                      │                │                │
 │  Executa ação de A no Minecraft                 │                │                │
 │  Loga A, B, C no Supabase                      │                │                │
```

As 3 requisições são disparadas em paralelo via `Promise.all`. O hub recebe cada uma independentemente e redireciona para o endpoint da máquina correspondente.

---

## Pipeline de Coleta de Dados

### Início da sessão

```
AgentLoop.start()
     │
     ├── llm.getOnlineParticipants()    → lista com specs de hardware
     │
     ├── logger.logSession({...})       → INSERT em sessions
     │
     └── logger.logParticipantSnapshots({...})  → INSERT em participant_snapshots
              │
              └── specs capturadas automaticamente pelo gambi join:
                  { cpu: "AMD Ryzen 7 5800X", ram: "32GB",
                    gpu: "NVIDIA RTX 4090", vram: "24GB", os: "Ubuntu 24.04" }
```

### A cada ciclo

```
AgentLoop (cada ciclo)
     │
     ├── Fan-out → N respostas
     │
     ├── Seleciona + executa 1
     │
     ├── DataLogger.log([               ← N linhas, uma por participante
     │     { participant: "joao",  was_executed: true,  llm_response_time_ms: 842 },
     │     { participant: "maria", was_executed: false, llm_response_time_ms: 1203 },
     │     { participant: "pedro", was_executed: false, llm_response_time_ms: 956 },
     │   ])
     │        │
     │        ├── Acumula em buffer (até 20 registros)
     │        └── Quando cheio → batch POST para Supabase (fire-and-forget)
     │
     └── sleep(3000)
```

### O que é coletado por resposta

| Categoria | Campos | Origem |
|-----------|--------|--------|
| Sessão | `session_id`, `cycle_number`, `room_code` | AgentLoop |
| Participante | `participant_id`, `participant_nickname`, `model_name` | SDK |
| LLM | `llm_response_time_ms`, `llm_raw_length`, `llm_json_repaired`, `llm_parse_error`, `llm_error` | GambiLLM + jsonParser |
| Ação parseada | `action`, `reasoning`, `direction`, `target`, `content`, `raw_response` | Parse da resposta |
| Execução | `was_executed`, `action_success`, `action_execution_time_ms`, `action_error` | ActionExecutor (só na selecionada) |
| Jogo | `health`, `food`, `pos_x/y/z`, `biome`, `weather`, `nearby_*`, `inventory_items` | PerceptionManager |

### Specs capturadas por snapshot

| Campo | Exemplo | Origem |
|-------|---------|--------|
| `cpu` | "AMD Ryzen 7 5800X" | `gambi join` (automático) |
| `ram` | "32GB" | `gambi join` (automático) |
| `gpu` | "NVIDIA RTX 4090" | `gambi join` (automático) |
| `vram` | "24GB" | `gambi join` (automático) |
| `os` | "Ubuntu 24.04" | `gambi join` (automático) |
| `specs_raw` | JSON completo | Backup com todos os campos |

---

## Estrutura de Diretórios

```
minecraft-bot/
├── src/
│   ├── index.ts                  # Bootstrap, CLI args, graceful shutdown
│   ├── config/
│   │   └── settings.ts           # Configurações (Gambi + Minecraft + Benchmark)
│   ├── bot/                      # Camada Minecraft (Mineflayer)
│   │   ├── ActionExecutor.ts     # Traduz decisões em comandos do jogo
│   │   ├── BotManager.ts         # Conexão, eventos, reconexão automática
│   │   ├── MovementManager.ts    # Andar, explorar, seguir, fugir
│   │   └── PerceptionManager.ts  # Extrai contexto do mundo
│   ├── core/                     # Lógica central
│   │   ├── AgentLoop.ts          # Loop fan-out: prompt → todos → seleciona → executa → log
│   │   ├── MemoryManager.ts      # Ring buffer de 15 eventos recentes
│   │   └── DataLogger.ts         # 3 tabelas Supabase (sessions, snapshots, responses)
│   ├── llm/
│   │   └── GambiarraLLM.ts       # invokeAll() fan-out + getOnlineParticipants()
│   ├── prompts/
│   │   └── botPrompts.ts         # System prompt + template do user message
│   ├── schemas/
│   │   └── botAction.ts          # Schema Zod das ações válidas
│   ├── types/
│   │   ├── types.ts              # Interfaces TypeScript (inclui FanOutResult)
│   │   └── gambi-sdk.d.ts        # Tipos do SDK Gambi (ParticipantInfo, specs)
│   └── utils/
│       ├── args.ts               # Parser CLI (--room, --hub)
│       ├── jsonParser.ts         # Parse + reparo de JSON (jsonrepair)
│       └── sleep.ts              # Delay assíncrono
├── supabase/
│   └── schema.sql                # DDL: 3 tabelas + índices + RLS + views
├── .env.example
└── package.json
```

---

## Decisões de Design

### Por que fan-out no bot e não no hub?

O hub do Gambi é um proxy transparente — não alteramos ele. O fan-out é feito no bot: ele lista os participantes, dispara N requests em paralelo (um por participante via `gambi.participant(id)`), e coleta todas as respostas. Do ponto de vista do hub, são N requests independentes — ele não sabe que vieram do mesmo ciclo.

### Por que capturar specs via listParticipants()?

O `gambi join` detecta e registra automaticamente as specs da máquina (CPU, RAM, GPU, VRAM, OS). O SDK expõe essas informações via `listParticipants()`. Capturamos uma vez no início da sessão e salvamos em `participant_snapshots`, assim a análise pode correlacionar latência com hardware sem registro manual.

### Por que selecionar a mais rápida?

A estratégia `fastest` garante que o bot reaja o mais rápido possível, mantendo gameplay fluido. Mas como TODAS as respostas são logadas, a análise posterior não perde nada — cada resposta tem sua latência registrada independente de ter sido executada ou não.

### Por que 3 tabelas e não 1?

- `sessions` — normaliza metadados da sessão, evita repetir room_code/bot_username em cada linha
- `participant_snapshots` — specs de hardware são estáticas dentro de uma sessão, não faz sentido repetir em cada ciclo
- `cycle_responses` — dados variáveis, uma linha por participante por ciclo

As views `v_latency_by_setup` e `v_fastest_per_cycle` fazem JOINs entre as tabelas para análise.

### Por que Supabase?

- **Centralizado** — todos os dados num só lugar, sem coletar arquivos
- **Zero dependência** — é um `fetch` POST, sem drivers
- **Grátis** — free tier com 500MB
- **SQL** — queries analíticas diretas com JOINs e agregações
- **REST** — fire-and-forget, sem conexão persistente

### Por que fire-and-forget?

O loop roda a cada 3s. Com fan-out para N participantes, cada ciclo já espera N respostas LLM. O log não pode adicionar latência. O `DataLogger` acumula em buffer e envia em batch — se falhar, tenta no próximo flush. Se o buffer passar de 500, descarta os mais antigos.

### Por que Chat Completions e não Responses API?

A maioria dos provedores locais (Ollama, LM Studio) suporta `chat/completions` nativamente. A Responses API é mais nova e nem todos implementam. O hub do Gambi faz fallback automático se necessário.

---

## Como Executar

### Pré-requisitos

1. **Bun** instalado
2. **Servidor Minecraft** Java Edition rodando
3. **Gambi Hub** rodando com 2+ participantes LLM

### Passo a passo

```bash
# 1. Iniciar hub
gambi serve --port 3000

# 2. Criar sala
gambi create --name "Benchmark AI"
# → Room code: ABC123

# 3. Cada pessoa com LLM entra
gambi join --code ABC123 --model llama3       # Máquina A
gambi join --code ABC123 --model mistral      # Máquina B

# 4. Clonar e rodar o bot
git clone <repo>
cd minecraft-bot
bun install
cp .env.example .env
# Editar .env com SUPABASE_URL e SUPABASE_ANON_KEY

# 5. Executar schema no Supabase SQL Editor

# 6. Rodar
bun run dev -- --room ABC123
```

### Exemplo de saída

```
🤖 Minecraft Bot — Benchmark Fan-out

   Sala: ABC123
   Hub:  http://localhost:3000
   Modo: fan-out (todos os participantes)

📊 Session ID: a1b2c3d4-...

🖥️  Participantes online (3):
   joao — llama3 (GPU: NVIDIA RTX 4090, RAM: 32GB)
   maria — mistral (GPU: NVIDIA GTX 1080, RAM: 16GB)
   pedro — qwen2 (GPU: Apple M2 Pro, RAM: 16GB)

━━━ Ciclo #1 (3 participantes) ━━━
📡 Enviando prompt para todos os participantes...
   joao [llama3]: ✅ EXPLORAR (842ms)
   maria [mistral]: ✅ ANDAR (1203ms)
   pedro [qwen2]: ⚠️  JSON inválido
🏆 Selecionado: joao [llama3] — EXPLORAR (842ms)
💭 Raciocínio: Estou num lugar novo, vou explorar para encontrar recursos

━━━ Ciclo #2 (3 participantes) ━━━
📡 Enviando prompt para todos os participantes...
   joao [llama3]: ✅ COLETAR (765ms)
   maria [mistral]: ✅ COLETAR (1450ms)
   pedro [qwen2]: ✅ EXPLORAR (890ms)
🏆 Selecionado: joao [llama3] — COLETAR (765ms)
```
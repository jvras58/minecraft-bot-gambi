# Arquitetura — Minecraft Bot via Gambi

## Visão Geral

O projeto é um **bot autônomo de Minecraft** controlado por LLM. Cada participante roda sua própria instância: 1 bot = 1 LLM. Múltiplos bots entram no mesmo servidor Minecraft, cada um tomando decisões independentes com sua própria LLM. Métricas são coletadas no Supabase para comparação.

O bot se conecta ao **Gambi** — um hub open-source que interliga LLMs em rede local — para acessar o modelo rodando na máquina do participante.

```
┌──────────────────────────────────────────────────────────────────────┐
│                      VISÃO GERAL DO SISTEMA                          │
│                                                                      │
│                     ┌──────────────────────┐                         │
│                     │   Servidor Minecraft │                         │
│                     │                      │                         │
│                     └──────────┬───────────┘                         │
│                                │                                     │
│              ┌─────────────────┼─────────────────┐                   │
│              │                 │                 │                   │
│       ┌──────────┐      ┌──────────┐      ┌──────────┐               │
│       │  Bot PC1 │      │  Bot PC2 │      │  Bot PC3 │               │
│       │ AgentLoop│      │ AgentLoop│      │ AgentLoop│               │
│       └────┬─────┘      └────┬─────┘      └────┬─────┘               │
│            │                 │                  │                    │
│            ▼                 ▼                  ▼                    │
│  ┌───────────────────────────────────────────────────────┐           │
│  │                  GAMBI HUB (HTTP)                     │           │
│  │                                                       │           │
│  │  Sala: ABC123                                         │           │
│  │  ┌──────────────────────────────────────────────────┐ │           │
│  │  │ joao  → llama3  @ 192.168.1.50:11434 (RTX 4090)  │ │           │
│  │  │ maria → mistral @ 192.168.1.51:1234  (GTX 1080)  │ │           │
│  │  │ pedro → qwen2   @ 192.168.1.52:11434 (M2 Pro)    │ │           │
│  │  └──────────────────────────────────────────────────┘ │           │
│  └───────────────────────────────────────────────────────┘           │
│            │                 │                  │                    │
│            ▼                 ▼                  ▼                    │
│       ┌──────────┐     ┌──────────┐      ┌──────────┐                │
│       │  Ollama  │     │ LM Studio│      │  Ollama  │                │
│       │  llama3  │     │  mistral │      │  qwen2   │                │
│       │ RTX 4090 │     │ GTX 1080 │      │  M2 Pro  │                │
│       └──────────┘     └──────────┘      └──────────┘                │
│                                                                      │
│              Cada bot fala APENAS com sua própria LLM                │
│                                                                      │
│                     ┌──────────────────────┐                         │
│                     │      Supabase        │                         │
│                     │ sessions             │                         │
│                     │ participant_snapshots│                         │
│                     │ cycle_responses      │                         │
│                     └──────────────────────┘                         │
└──────────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Bot Minecraft (este repositório)

Aplicação TypeScript/Bun que se conecta a:

- **Servidor Minecraft** via Mineflayer (protocolo nativo)
- **Gambi Hub** via SDK (HTTP REST, API compatível com OpenAI)

O bot **não** roda nenhum LLM. Os prompts são definidos localmente em `botPrompts.ts` e enviados a cada ciclo via SDK. A inferência acontece na máquina do participante.

### 2. Gambi Hub

Servidor HTTP central que gerencia salas e redireciona requisições LLM. O hub **não** processa inferência — é um proxy transparente que:

- Mantém registro de quais máquinas estão online e quais modelos oferecem
- Redireciona requisições para o endpoint da máquina correspondente
- Retorna a resposta sem modificar o conteúdo

### 3. Gambi SDK

Provider do Vercel AI SDK:

```typescript
// Listar participantes (usado no startup)
const participants = await gambi.listParticipants();

// Enviar prompt para o participante deste bot
const result = await generateText({
  model: gambi.participant("joao"),
  system: systemPrompt,
  messages: [...],
});
```

### 4. Supabase (Coleta de Dados)

Banco Postgres com 3 tabelas:

| Tabela | Descrição | Quando insere |
|--------|-----------|---------------|
| `sessions` | Metadados da sessão (room, bot, participante) | Uma vez no início |
| `participant_snapshots` | Specs da máquina (CPU, RAM, GPU, VRAM, OS) | Uma vez no início |
| `cycle_responses` | Uma linha por ciclo — latência, ação, resultado, prompt | A cada ciclo (~3s) |

Configuração opcional — sem `SUPABASE_URL` e `SUPABASE_ANON_KEY`, o bot funciona normalmente.

---

## Ciclo de Decisão (AgentLoop)

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTLOOP (ciclo de ~3s)                      │
│                                                                  │
│  ┌──────────────┐                                                │
│  │ 1. PERCEPÇÃO │  PerceptionManager.getGameContext()            │
│  │              │  → vida, fome, posição, entidades,             │
│  │              │    blocos, inventário, bioma, clima            │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 2. PROMPT    │  system + contexto + memória (15 eventos)      │
│  │              │  Definidos em botPrompts.ts (local)            │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 3. LLM       │  GambiLLM.invoke(messages)                     │
│  │              │  → 1 chamada para 1 participante               │
│  │              │  → timeout configurável (120s default)         │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 4. PARSE     │  safeParseJSON() + normalizeAction()           │
│  │              │  + botActionSchema.parse()                     │
│  │              │  Se falhar → fallback EXPLORAR                 │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 5. EXECUÇÃO  │  ActionExecutor.executar(ação)                 │
│  │              │  → mineflayer: andar, falar, coletar...        │
│  └──────┬───────┘                                                │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ 6. LOG       │  DataLogger.log(cycleData)                     │
│  │              │  → 1 linha no Supabase por ciclo               │
│  │              │  → inclui prompt enviado e contexto do jogo    │
│  └──────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Comunicação

```
Bot (PC1)                Gambi Hub              Máquina PC1 (Ollama)
 │                          │                      │
 │  listParticipants()      │                      │
 │ ────────────────────────►│                      │
 │  ◄── [{joao, ...}]       │                      │
 │                          │                      │
 │  Resolve: joao é meu participante               │
 │                          │                      │
 │  POST participant:joao   │                      │
 │ ────────────────────────►│  forward ───────────►│
 │                          │                      │  (inferência LLM)
 │                          │  ◄── resposta (842ms)│
 │  ◄── resposta ───────────│                      │
 │                          │                      │
 │  Parse JSON + executa ação no Minecraft         │
 │  Loga métricas no Supabase                      │
```

---

## Pipeline de Coleta de Dados

### Início da sessão

```
main() → resolveParticipant()
     │
     ├── llm.getOnlineParticipants()    → encontra participante por nickname/ID
     │
     ├── logger.logSession({...})       → INSERT em sessions
     │
     └── logger.logParticipantSnapshot({...})  → INSERT em participant_snapshots
              │
              └── specs capturadas automaticamente pelo gambi join:
                  { cpu: "AMD Ryzen 7 5800X", ram: "32GB",
                    gpu: "NVIDIA RTX 4090", vram: "24GB", os: "Ubuntu 24.04" }
```

### A cada ciclo

```
AgentLoop (cada ciclo)
     │
     ├── Invoke LLM → 1 resposta
     │
     ├── Parse + executa ação
     │
     ├── DataLogger.log({
     │     participant: "joao",
     │     llm_response_time_ms: 842,
     │     action: "EXPLORAR",
     │     action_success: true,
     │     prompt_sent: "[system]\n...\n[user]\n...",
     │     health: 20, pos_x: 142, ...
     │   })
     │        │
     │        ├── Acumula em buffer (até 20 registros)
     │        └── Quando cheio → batch POST para Supabase (fire-and-forget)
     │
     └── sleep(3000)
```

### O que é coletado por ciclo

| Categoria | Campos | Origem |
|-----------|--------|--------|
| Sessão | `session_id`, `cycle_number`, `room_code` | AgentLoop |
| Participante | `participant_id`, `participant_nickname`, `model_name` | Startup |
| LLM | `llm_response_time_ms`, `llm_raw_length`, `llm_json_repaired`, `llm_parse_error`, `llm_error` | GambiLLM + jsonParser |
| Ação | `action`, `reasoning`, `direction`, `target`, `content`, `raw_response` | Parse |
| Execução | `action_success`, `action_execution_time_ms`, `action_error` | ActionExecutor |
| Prompt | `prompt_sent` | buildMessages() |
| Jogo | `health`, `food`, `pos_x/y/z`, `biome`, `weather`, `nearby_*`, `inventory_items` | PerceptionManager |

---

## Estrutura de Diretórios

```
minecraft-bot/
├── src/
│   ├── index.ts                  # Bootstrap, resolve participante, inicia loop
│   ├── config/
│   │   └── settings.ts           # Configurações (Gambi + Minecraft + agente)
│   ├── bot/                      # Camada Minecraft (Mineflayer)
│   │   ├── ActionExecutor.ts     # Traduz decisões em comandos do jogo
│   │   ├── BotManager.ts         # Conexão, eventos, reconexão automática
│   │   ├── MovementManager.ts    # Andar, explorar, seguir, fugir
│   │   └── PerceptionManager.ts  # Extrai contexto do mundo
│   ├── core/                     # Lógica central
│   │   ├── AgentLoop.ts          # Loop: percepção → LLM → parse → executa → log
│   │   ├── MemoryManager.ts      # Ring buffer de 15 eventos recentes
│   │   └── DataLogger.ts         # Métricas → Supabase (fire-and-forget)
│   ├── llm/
│   │   └── GambiarraLLM.ts       # invoke() para 1 participante
│   ├── prompts/
│   │   └── botPrompts.ts         # System prompt + template do user message
│   ├── schemas/
│   │   └── botAction.ts          # Schema Zod das ações válidas
│   ├── types/
│   │   ├── types.ts              # Interfaces TypeScript
│   │   └── gambi-sdk.d.ts        # Tipos do SDK Gambi
│   └── utils/
│       ├── args.ts               # Parser CLI (--room, --participant, --hub)
│       ├── fuzzyAction.ts        # Normalização fuzzy de ações (Levenshtein)
│       ├── jsonParser.ts         # Parse + reparo de JSON (jsonrepair)
│       └── sleep.ts              # Delay assíncrono
├── supabase/
│   └── schema.sql                # DDL: 3 tabelas + índices + RLS + views
├── .env.example
└── package.json
```

---

## Decisões de Design

### Por que 1 bot = 1 LLM?

Cada participante roda o bot na sua própria máquina. O bot se conecta ao Minecraft e usa a LLM local (via Gambi Hub) para tomar decisões. Isso garante que as métricas de cada LLM × hardware reflitam o desempenho real — latência inclui a inferência local, não rede entre máquinas.

### Por que Gambi Hub como intermediário?

O hub centraliza a descoberta de participantes e suas specs de hardware. Sem ele, cada bot precisaria saber o endpoint direto da LLM. Com o hub, basta entrar na sala (`gambi join`) e o bot descobre automaticamente quem é o participante local.

### Por que 3 tabelas e não 1?

- `sessions` — metadados da sessão (1 linha por execução do bot)
- `participant_snapshots` — specs de hardware, estáticas dentro de uma sessão
- `cycle_responses` — dados variáveis, 1 linha por ciclo (~3s)

### Por que Supabase?

- **Centralizado** — todos os bots logam no mesmo banco
- **Zero dependência** — é um `fetch` POST, sem drivers
- **Grátis** — free tier com 500MB
- **SQL** — queries analíticas diretas com JOINs e agregações

### Por que fire-and-forget no log?

O loop roda a cada 3s. O log não pode adicionar latência. O `DataLogger` acumula em buffer e envia em batch — se falhar, tenta no próximo flush.

### Por que salvar o prompt enviado?

O prompt muda a cada ciclo (contexto do jogo + memória são dinâmicos). Salvar permite reproduzir o experimento e analisar se determinado contexto causa mais erros em certos modelos.

---

## Como Executar

### Pré-requisitos

1. **Bun** instalado
2. **Servidor Minecraft**
3. **Gambi Hub** rodando

### Passo a passo

```bash
# 1. Iniciar hub
gambi serve --port 3000

# 2. Criar sala
gambi create --name "Experimento TCC"
# → Room code: ABC123

# 3. Em CADA máquina participante:

# Terminal 1 — entrar na sala com a LLM
gambi join --code ABC123 --model llama3

# Terminal 2 — rodar o bot
cd minecraft-bot
bun install
cp .env.example .env
# Editar .env (SUPABASE_URL, SUPABASE_ANON_KEY, BOT_USERNAME)
bun run dev -- --room ABC123 --participant id-do-participant
```

### Exemplo de saída

```
🤖 Minecraft Bot — Agente Autônomo

   Sala: ABC123
   Hub:  http://localhost:3000

🔍 Auto-detectado: joao (llama3)
✅ Participante: joao — llama3 (GPU: NVIDIA RTX 4090, RAM: 32GB)

🧠 Agente ativado — joao [llama3]
📊 Session ID: a1b2c3d4-...

━━━ Ciclo #1 ━━━
✅ EXPLORAR (842ms)
💭 Estou num lugar novo, vou explorar para encontrar recursos

━━━ Ciclo #2 ━━━
✅ COLETAR (765ms)
💭 Vi madeira próxima, vou coletar para craftar ferramentas
```

# Arquitetura — Minecraft Bot com IA via Gambi

## Visão Geral

O projeto é um **bot autônomo de Minecraft** que usa Large Language Models (LLMs) para tomar decisões em tempo real. Em vez de chamar uma API cloud (OpenAI, Anthropic), o bot se conecta ao **Gambi** — um sistema distribuído de compartilhamento de LLMs em rede local — para usar modelos rodando nas máquinas dos próprios participantes.

Cada pessoa baixa o projeto, roda o bot localmente, e todos jogam juntos no mesmo servidor Minecraft. Os LLMs são compartilhados via uma sala do Gambi: quem tem GPU contribui com modelos, quem não tem usa os modelos dos outros.

```
┌─────────────────────────────────────────────────────────────────┐
│                     VISÃO GERAL DO SISTEMA                      │
│                                                                 │
│  Jogador A (RTX 4090)          Jogador B (MacBook, sem GPU)    │
│  ┌──────────┐ ┌──────────┐    ┌──────────┐                    │
│  │ Ollama   │ │ Bot MC   │    │ Bot MC   │                    │
│  │ llama3   │ │ (este    │    │ (este    │                    │
│  │          │ │  projeto)│    │  projeto)│                    │
│  └────┬─────┘ └────┬─────┘    └────┬─────┘                    │
│       │ LLM        │ SDK          │ SDK                       │
│       │ endpoint   │              │                            │
│       ▼            ▼              ▼                            │
│  ┌──────────────────────────────────────────┐                  │
│  │            GAMBI HUB (HTTP)              │                  │
│  │                                          │                  │
│  │  Sala: XK7P2M                           │                  │
│  │  ┌────────────────────────────────────┐ │                  │
│  │  │ jogador-a → llama3 @ :11434       │ │                  │
│  │  │ jogador-c → mistral @ :1234       │ │                  │
│  │  └────────────────────────────────────┘ │                  │
│  └──────────────────────────────────────────┘                  │
│       ▲                                                        │
│       │ LLM endpoint                                           │
│  ┌────┴─────┐ ┌──────────┐                                    │
│  │ LM Studio│ │ Bot MC   │    Jogador C (Linux + GTX 1080)    │
│  │ mistral  │ │          │                                     │
│  └──────────┘ └──────────┘                                     │
│                                                                 │
│  ┌──────────────────────────────────────────┐                  │
│  │         SUPABASE (Postgres)              │                  │
│  │  Coleta automática de métricas           │                  │
│  │  de todos os bots via REST               │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
│  ┌──────────┐                                                  │
│  │ Servidor │    Paper MC (Java Edition)                       │
│  │Minecraft │    Todos os bots conectam aqui                   │
│  └──────────┘                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Bot Minecraft (este repositório)

O bot é uma aplicação TypeScript/Bun que cada jogador executa localmente. Ele se conecta a dois serviços:

- **Servidor Minecraft** via Mineflayer (protocolo nativo do Minecraft)
- **Gambi Hub** via SDK (HTTP REST, API compatível com OpenAI)

O bot **não** roda nenhum LLM. Ele apenas envia prompts e recebe respostas. A inferência acontece na máquina de quem compartilhou o modelo.

### 2. Gambi Hub

Servidor HTTP central que gerencia salas e roteia requisições LLM. Cada sala tem um código de 6 caracteres (ex: `XK7P2M`). Participantes registram seus endpoints LLM na sala, e qualquer cliente conectado à sala pode usar qualquer LLM disponível.

O hub **não** processa inferência. Ele é um proxy inteligente que:

- Recebe o request do bot (via SDK)
- Resolve para qual participante enviar (por modelo, ID, ou aleatório)
- Faz forward do request para o endpoint do participante
- Retorna a resposta para o bot

### 3. Gambi SDK

Provider do Vercel AI SDK que abstrai a comunicação com o hub. O bot usa o SDK assim:

```typescript
import { createGambi } from 'gambi-sdk';
import { generateText } from 'ai';

const gambi = createGambi({
  roomCode: 'XK7P2M',
  hubUrl: 'http://192.168.1.100:3000',
  defaultProtocol: 'chatCompletions',
});

const result = await generateText({
  model: gambi.any(),     // qualquer LLM disponível na sala
  prompt: "Decida a próxima ação",
});
```

### 4. Supabase (Coleta de Métricas)

Banco Postgres online que recebe métricas de todos os bots automaticamente via REST API. Cada ciclo de decisão do bot gera um registro com dados do LLM, da ação e do contexto do jogo.

Configuração opcional — se o jogador não configurar as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`, o bot funciona normalmente sem coletar dados.

---

## Ciclo de Decisão (AgentLoop)

O bot opera em um loop contínuo a cada 3 segundos:

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTLOOP (3s cycle)                     │
│                                                             │
│  ┌─────────────┐                                            │
│  │ 1. PERCEPÇÃO│  PerceptionManager.getGameContext()        │
│  │             │  → vida, fome, posição, entidades,         │
│  │             │    blocos, inventário, bioma, clima        │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ 2. MEMÓRIA  │  MemoryManager.toPromptString()            │
│  │             │  → últimos 15 eventos (ring buffer)        │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ 3. PROMPT   │  botPromptTemplate.system + human          │
│  │             │  → contexto + memória + contagem ações     │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ 4. LLM      │  GambiLLM.invoke(messages)                 │
│  │             │  → SDK → Hub → Participante → resposta     │
│  │             │  ← JSON: { acao, raciocinio, alvo, ... }   │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ 5. PARSE    │  safeParseJSON() + botActionSchema.parse   │
│  │             │  → validação Zod, reparo com jsonrepair    │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ 6. AÇÃO     │  ActionExecutor.executar(decisao)          │
│  │             │  → mineflayer: andar, falar, coletar...    │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ 7. LOG      │  DataLogger.log(cycleData)                 │
│  │             │  → fire-and-forget POST para Supabase      │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de Comunicação Detalhado

### Request LLM (Bot → Gambi → Participante)

```
Bot (Jogador B)                Gambi Hub                 Ollama (Jogador A)
     │                            │                           │
     │  POST /rooms/XK7P2M/v1/    │                           │
     │  chat/completions          │                           │
     │  { model: "*",             │                           │
     │    messages: [...] }       │                           │
     │ ──────────────────────────►│                           │
     │                            │  (resolve: model "*"      │
     │                            │   → jogador-a, online)    │
     │                            │                           │
     │                            │  POST /v1/chat/completions│
     │                            │  { model: "llama3",       │
     │                            │    messages: [...] }      │
     │                            │ ─────────────────────────►│
     │                            │                           │
     │                            │  200 OK                   │
     │                            │  { choices: [...] }       │
     │                            │ ◄─────────────────────────│
     │                            │                           │
     │  200 OK                    │                           │
     │  { choices: [...] }        │                           │
     │ ◄──────────────────────────│                           │
     │                            │                           │
```

### Roteamento de Modelos

O campo `model` no request controla qual participante atende:

| Valor no `--model` | Método SDK | Comportamento |
|---------------------|------------|---------------|
| `*` (default) | `gambi.any()` | Participante online aleatório |
| `llama3` | `gambi.model("llama3")` | Primeiro participante com esse modelo |
| `participant:joao-4090` | `gambi.participant("joao-4090")` | Participante específico pelo ID |

Isso permite:

- **Uso casual**: `*` — qualquer LLM serve, máxima disponibilidade
- **Experimento controlado**: `llama3` — forçar um modelo específico
- **Benchmark de hardware**: `participant:X` — forçar uma máquina específica

---

## Estrutura de Diretórios

```
minecraft-bot/
├── src/
│   ├── index.ts                  # Bootstrap, CLI args, graceful shutdown
│   ├── config/
│   │   └── settings.ts           # Configurações (Gambi + Minecraft + Agent)
│   ├── bot/                      # Camada Minecraft (Mineflayer)
│   │   ├── ActionExecutor.ts     # Traduz decisões em comandos do jogo
│   │   ├── BotManager.ts         # Conexão, eventos, reconexão automática
│   │   ├── MovementManager.ts    # Andar, explorar, seguir, fugir
│   │   └── PerceptionManager.ts  # Extrai contexto do mundo (vida, entidades, blocos)
│   ├── core/                     # Lógica central
│   │   ├── AgentLoop.ts          # Loop percepção → raciocínio → ação → log
│   │   ├── MemoryManager.ts      # Ring buffer de 15 eventos recentes
│   │   └── DataLogger.ts         # Envia métricas para Supabase (fire-and-forget)
│   ├── llm/
│   │   └── GambiarraLLM.ts       # Cliente LLM via Gambi SDK + Vercel AI SDK
│   ├── prompts/
│   │   └── botPrompts.ts         # System prompt + template do user message
│   ├── schemas/
│   │   └── botAction.ts          # Schema Zod das ações válidas
│   ├── types/
│   │   └── types.ts              # Interfaces TypeScript
│   └── utils/
│       ├── args.ts               # Parser de argumentos CLI
│       ├── jsonParser.ts         # Parse + reparo de JSON (jsonrepair)
│       └── sleep.ts              # Delay assíncrono
├── supabase/
│   └── schema.sql                # DDL da tabela de métricas
├── .env.example                  # Variáveis de ambiente (Minecraft + Gambi + Supabase)
└── package.json
```

---

## Pipeline de Coleta de Dados

### O que é coletado

A cada ciclo (~3s), o DataLogger registra:

| Categoria | Campos | Origem |
|-----------|--------|--------|
| Sessão | `session_id`, `bot_username`, `room_code`, `model_selector` | Configuração do bot |
| LLM | `llm_response_time_ms`, `llm_raw_length`, `llm_json_repaired`, `llm_parse_error` | GambiLLM + jsonParser |
| Decisão | `action`, `action_success`, `action_execution_time_ms`, `reasoning`, `direction`, `target` | ActionExecutor + LLM response |
| Jogo | `health`, `food`, `pos_x/y/z`, `biome`, `weather`, `nearby_players/entities/blocks`, `inventory_items` | PerceptionManager |

### Como funciona

```
AgentLoop (cada ciclo)
     │
     ├── Executa ação
     │
     ├── DataLogger.log(cycleData)     ← NÃO bloqueia (sem await)
     │        │
     │        ├── Acumula em buffer (até 10 registros)
     │        │
     │        └── Quando buffer cheio:
     │             POST /rest/v1/bot_cycles   → Supabase
     │             (batch insert, fire-and-forget)
     │
     └── sleep(3000)
```

**Impacto no jogador: zero.** O `fetch` é assíncrono e não usa `await` no loop principal. Se o Supabase estiver fora do ar, os registros voltam pro buffer e tentam de novo no próximo flush. Se o buffer passar de 200, descarta os mais antigos.

### Configuração

Quem quer participar da coleta:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Quem não quer: não configura nada. O DataLogger detecta que as variáveis não existem e fica inerte.

---

## Integração com Gambi SDK — Detalhes

### GambiLLM.ts

A classe `GambiLLM` é o wrapper que conecta o bot ao Gambi:

```typescript
// Inicialização
const provider = createGambi({
  roomCode: 'XK7P2M',
  hubUrl: 'http://localhost:3000',
  defaultProtocol: 'chatCompletions',  // usa chat/completions (não Responses API)
});

// Resolução do modelo
if (modelSelector === '*')           → provider.any()
if (modelSelector === 'participant:X') → provider.participant('X')
else                                    → provider.model(modelSelector)

// Invocação
const result = await generateText({
  model: this.getModel(),
  system: systemPrompt,
  messages: [...],
  temperature: 0.8,
});
```

O SDK do Gambi cria internamente um provider `@ai-sdk/openai-compatible` apontando para:

```
http://<hub>:<port>/rooms/<ROOM_CODE>/v1
```

Isso significa que o hub funciona como uma "OpenAI local" — qualquer ferramenta que aceite base URL customizada funciona.

### Health Check

Antes de iniciar o loop, o bot verifica se o hub está acessível e se a sala tem participantes:

```typescript
const models = await provider.listModels();
// GET /rooms/XK7P2M/v1/models
// → retorna lista de participantes online com seus modelos
```

---

## Decisões de Design

### Por que Gambi SDK e não chamada HTTP direta?

O SDK do Gambi é um provider do Vercel AI SDK. Isso dá de graça: streaming, retry, tipagem, e compatibilidade com qualquer modelo que o participante exponha. Trocar de "Ollama local" para "Gambi distribuído" foi literalmente trocar `createOllama()` por `createGambi()`.

### Por que Chat Completions e não Responses API?

O bot usa `defaultProtocol: 'chatCompletions'` porque a maioria dos provedores locais (Ollama, LM Studio) suporta chat/completions nativamente. A Responses API é mais nova e nem todos os endpoints a implementam. O hub do Gambi faz fallback automático se necessário.

### Por que Supabase e não Redis/arquivo local?

- **Centralizado**: todos os bots escrevem no mesmo lugar, sem precisar coletar arquivos depois
- **Zero dependência**: é um `fetch` POST, não precisa instalar driver
- **Grátis**: o free tier do Supabase suporta 500MB e 50k rows/mês — mais que suficiente
- **SQL**: consultas analíticas diretas (`GROUP BY model, hardware`)
- **REST**: não precisa de conexão persistente, funciona com fire-and-forget

### Por que fire-and-forget?

O loop do bot roda a cada 3 segundos. A prioridade é que o bot continue jogando. Se o log falhar, o bot não pode travar. Por isso o `DataLogger.log()` nunca é `await`-ed — acumula em buffer e envia em batch quando conveniente.

---

## Como Executar

### Pré-requisitos

1. **Bun** instalado
2. **Servidor Minecraft** Java Edition rodando (Paper MC recomendado)
3. **Gambi Hub** rodando com pelo menos 1 participante LLM

### Passo a passo

```bash
# 1. Em alguma máquina: iniciar o hub
gambi serve --port 3000

# 2. Criar uma sala
gambi create --name "Minecraft AI"
# → Room code: XK7P2M

# 3. Quem tem LLM: entrar na sala
gambi join --code XK7P2M --model llama3 --endpoint http://localhost:11434

# 4. Cada jogador: clonar e rodar o bot
git clone <repo>
cd minecraft-bot
cp .env.example .env
# Editar .env se necessário

bun install
bun run dev -- --room XK7P2M
```

### Com coleta de dados

```bash
# Adicionar no .env:
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Executar schema no Supabase SQL Editor:
# → conteúdo de supabase/schema.sql

# Rodar normalmente — métricas são enviadas automaticamente
bun run dev -- --room XK7P2M
```
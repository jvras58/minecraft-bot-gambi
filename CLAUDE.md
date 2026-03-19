# Minecraft Bot - Development Context

Autonomous Minecraft bot that uses Gambiarra hub as its LLM backend.

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Bun | TypeScript execution, .env loading |
| Minecraft | mineflayer | Bot control, world interaction |
| LLM | Gambiarra Hub (HTTP) | OpenAI-compatible chat/completions |
| Validation | Zod | Action schema validation |
| JSON repair | jsonrepair | Fix malformed LLM outputs |

## Architecture

```
AgentLoop (3s cycle)
  ├── PerceptionManager.getContextString()  → game state as text
  ├── MemoryManager.toPromptString()        → last 15 events
  ├── GambiarraLLM.invoke(messages)         → POST /rooms/:code/v1/chat/completions
  ├── safeParseJSON + botActionSchema.parse  → validate LLM response
  ├── ActionExecutor.executar(action)        → mineflayer commands
  └── MemoryManager.recordAction()           → update ring buffer
```

## Key Decisions

- **No LangChain**: Direct fetch to Gambiarra hub's OpenAI-compatible API
- **No Prisma/DB**: Metrics removed; if needed later, use Gambiarra's SSE events
- **No systeminformation**: Hardware monitoring removed
- **Bun-native**: Uses Bun's built-in .env loading, no dotenv needed

## Running

```bash
# From monorepo root
bun run --filter minecraft-bot dev

# Or directly
cd apps/minecraft-bot && bun run dev
```

## Prerequisites

1. Minecraft Java server running
2. Gambiarra hub running with at least one LLM participant in a room
3. `.env` configured with `GAMBIARRA_ROOM_CODE`

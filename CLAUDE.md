# Minecraft Bot - Development Context

Autonomous Minecraft bot that uses Gambi hub as its LLM backend.

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

## Running

```bash
# From monorepo root
bun run --filter minecraft-bot dev

# Or directly
cd minecraft-bot && bun run dev
```

## Prerequisites

1. Minecraft Java server running
2. Gambiarra hub running with at least one LLM participant in a room

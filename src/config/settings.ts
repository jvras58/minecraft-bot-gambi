/** Configurações globais do bot, Gambi Hub e agente. */
import type { BotConfig } from '@/types/types';

export const botConfig: BotConfig = {
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '25565'),
  username: process.env.BOT_USERNAME || 'AgenteBot',
  auth: (process.env.BOT_AUTH as 'offline' | 'microsoft') || 'offline',
  version: process.env.MINECRAFT_VERSION || '1.21.11',
  checkTimeoutInterval: 60_000,
};

export const gambiarraConfig = {
  hubUrl: process.env.GAMBIARRA_HUB_URL || 'http://localhost:3000',
};

export const agentConfig = {
  loopIntervalMs: 3_000,
  disconnectedWaitMs: 2_000,
  shortTermMemorySize: 15,
  perceptionBlockRadius: 8,
  perceptionEntityRadius: 16,
  /** Timeout da chamada LLM (ms) */
  llmTimeoutMs: 120_000,
};

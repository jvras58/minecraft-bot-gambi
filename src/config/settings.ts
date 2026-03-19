import type { BotConfig } from '../types/types';

export const botConfig: BotConfig = {
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '25565'),
  username: process.env.BOT_USERNAME || 'AgenteBot',
  auth: (process.env.BOT_AUTH as 'offline' | 'microsoft') || 'offline',
  checkTimeoutInterval: 60_000,
};

export const gambiarraConfig = {
  /** URL do hub Gambiarra (pode ser sobrescrito via --hub) */
  hubUrl: process.env.GAMBIARRA_HUB_URL || 'http://localhost:3000',
  /** Modelo padrão (pode ser sobrescrito via --model) */
  model: process.env.GAMBIARRA_MODEL || '*',
};

export const agentConfig = {
  /** Intervalo entre ciclos do loop principal (ms) */
  loopIntervalMs: 3_000,
  /** Intervalo de espera quando desconectado (ms) */
  disconnectedWaitMs: 2_000,
  /** Tamanho máximo da memória de curto prazo */
  shortTermMemorySize: 15,
  /** Raio de percepção para blocos (em blocos) */
  perceptionBlockRadius: 8,
  /** Raio de percepção para entidades (em blocos) */
  perceptionEntityRadius: 16,
};

/**
 * settings.ts
 *
 * Configurações globais do bot, Gambi Hub e agente.
 */
import type { BotConfig } from '../types/types';

export const botConfig: BotConfig = {
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '25565'),
  username: process.env.BOT_USERNAME || 'AgenteBot',
  auth: (process.env.BOT_AUTH as 'offline' | 'microsoft') || 'offline',
  checkTimeoutInterval: 60_000,
};

export const gambiarraConfig = {
  /** URL do hub Gambi (pode ser sobrescrito via --hub) */
  hubUrl: process.env.GAMBIARRA_HUB_URL || 'http://localhost:3000',
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
  /** Timeout por participante no fan-out (ms) — evita que 1 máquina lenta trave o ciclo */
  fanOutTimeoutMs: 30_000,
  /** Estratégia de seleção da resposta executada: 'fastest' | 'random' */
  selectionStrategy: 'fastest' as 'fastest' | 'random',
};
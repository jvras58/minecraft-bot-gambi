// ─── Bot Config ───────────────────────────────────────────────
export interface BotConfig {
  host: string;
  port: number;
  username: string;
  auth: 'offline' | 'microsoft';
  checkTimeoutInterval: number;
}

// ─── Actions (fonte da verdade: Zod schema) ──────────────
export type { BotAction } from '../schemas/botAction';

// ─── Perception ───────────────────────────────────────────────
export interface GameContext {
  vida: number;
  fome: number;
  posicao: { x: number; y: number; z: number };
  estaAndando: boolean;
  jogadoresProximos: string[];
  entidadesProximas: EntityInfo[];
  blocosProximos: BlockInfo[];
  horaDoDia: number;
  clima: string;
  inventario: InventoryItem[];
  bioma: string;
}

export interface EntityInfo {
  nome: string;
  tipo: string;
  distancia: number;
  vida?: number;
}

export interface BlockInfo {
  nome: string;
  posicao: { x: number; y: number; z: number };
  distancia: number;
}

export interface InventoryItem {
  nome: string;
  quantidade: number;
  slot: number;
}

// ─── Memory ───────────────────────────────────────────────────
export interface MemoryEntry {
  timestamp: number;
  tipo: 'acao' | 'evento' | 'observacao' | 'interacao';
  resumo: string;
  dados?: Record<string, unknown>;
}

// ─── LLM ──────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  responseTimeMs: number;
}

// ─── Prompts ──────────────────────────────────────────────────
export interface PromptTemplate {
  system: string;
  human: string;
}

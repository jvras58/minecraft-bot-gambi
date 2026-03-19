/**
 * types.ts
 *
 * Define tipos globais do projeto para configuração, contexto do jogo, memória, entidades, inventário e LLM.
 * Centraliza contratos de dados usados por todos os módulos do bot.
 *
 * Principais tipos:
 *   - BotConfig: configurações do bot Minecraft.
 *   - BotAction: ações válidas (importadas do schema).
 *   - GameContext: estado do jogo percebido pelo bot.
 *   - EntityInfo, BlockInfo, InventoryItem: detalhes de entidades, blocos e inventário.
 *   - MemoryEntry: eventos e ações registrados na memória.
 *   - ChatMessage: estrutura de mensagens para LLM.
 *
 * Extensão:
 *   - Adicione novos tipos conforme expansão do bot.
 *
 * Uso:
 *   Referenciado por quase todos os módulos para garantir tipagem consistente.
 */

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

/** Tipos globais do projeto. */

// ─── Bot Config ───────────────────────────────────────────────
export interface BotConfig {
  host: string;
  port: number;
  username: string;
  auth: 'offline' | 'microsoft';
  version?: string;
  checkTimeoutInterval: number;
}

// ─── Actions (fonte da verdade: Zod schema) ──────────────
export type { BotAction } from '@/schemas/botAction';

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
  acao?: string;
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

// ─── Fan-out ──────────────────────────────────────────────────

/** Resultado de uma chamada LLM a um participante específico */
export interface FanOutResult {
  participantId: string;
  nickname: string;
  modelName: string;
  response: LLMResponse | null;
  error: string | null;
}

/** Informações de um participante online (espelho do SDK) */
export interface OnlineParticipant {
  id: string;
  nickname: string;
  model: string;
  endpoint: string;
  specs?: {
    cpu?: string;
    ram?: string;
    gpu?: string;
    vram?: string;
    os?: string;
    [key: string]: unknown;
  };
}

// ─── Data Logger ─────────────────────────────────────────────
export interface CycleResponseData {
  // Sessão & Ciclo
  session_id: string;
  cycle_number: number;
  room_code: string;

  // Participante
  participant_id: string;
  participant_nickname: string;
  model_name: string;

  // LLM
  llm_response_time_ms: number | null;
  llm_raw_length: number | null;
  llm_json_repaired: boolean;
  llm_parse_error: boolean;
  llm_error: string | null;

  // Ação parseada
  action: string | null;
  reasoning: string | null;
  direction: string | null;
  target: string | null;
  content: string | null;
  raw_response: string | null;

  // Execução
  was_executed: boolean;
  action_success: boolean | null;
  action_execution_time_ms: number | null;
  action_error: string | null;

  // Contexto do jogo
  health: number;
  food: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  biome: string;
  weather: string;
  time_of_day: number;
  is_moving: boolean;
  nearby_players: number;
  nearby_entities: number;
  nearby_blocks: number;
  inventory_items: number;
}

// ─── Prompts ──────────────────────────────────────────────────
export interface PromptTemplate {
  system: string;
  human: string;
}

// metricas de ações
export interface ActionResult {
  success: boolean;
  action: string;
  direction?: string;
  content?: string;
  errorMessage?: string;
  executionTimeMs: number;
}
/**
 * DataLogger.ts
 *
 * Envia métricas do benchmark fan-out para Supabase via REST API.
 * Gerencia 3 tabelas: sessions, participant_snapshots, cycle_responses.
 * Fire-and-forget: não bloqueia o loop do bot.
 */
import type { OnlineParticipant } from '../types/types';

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

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 15_000;

export class DataLogger {
  private supabaseUrl: string | null;
  private supabaseKey: string | null;
  private buffer: CycleResponseData[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || null;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY || null;
    this.enabled = !!(this.supabaseUrl && this.supabaseKey);

    if (this.enabled) {
      console.log('📊 DataLogger ativo — enviando métricas para Supabase');
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    } else {
      console.log('📊 DataLogger inativo — configure SUPABASE_URL e SUPABASE_ANON_KEY para coletar dados');
    }
  }

  /**
   * Registra a sessão no banco (chamado uma vez no início).
   */
  async logSession(session: {
    id: string;
    room_code: string;
    bot_username: string;
    participant_count: number;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.insert('sessions', [session]).catch((err) =>
      console.warn(`📊 Falha ao registrar sessão: ${err instanceof Error ? err.message : err}`),
    );
  }

  /**
   * Registra snapshot das specs de cada participante (chamado uma vez no início).
   */
  async logParticipantSnapshots(
    sessionId: string,
    participants: OnlineParticipant[],
  ): Promise<void> {
    if (!this.enabled || participants.length === 0) return;

    const rows = participants.map((p) => ({
      session_id: sessionId,
      participant_id: p.id,
      nickname: p.nickname,
      model_name: p.model,
      endpoint: p.endpoint,
      cpu: p.specs?.cpu ?? null,
      ram: p.specs?.ram ?? null,
      gpu: p.specs?.gpu ?? null,
      vram: p.specs?.vram ?? null,
      os: p.specs?.os ?? null,
      specs_raw: p.specs ? JSON.stringify(p.specs) : null,
    }));

    await this.insert('participant_snapshots', rows).catch((err) =>
      console.warn(`📊 Falha ao registrar specs: ${err instanceof Error ? err.message : err}`),
    );
  }

  /**
   * Registra respostas de um ciclo (múltiplas linhas, uma por participante).
   */
  log(data: CycleResponseData[]): void {
    if (!this.enabled || data.length === 0) return;
    this.buffer.push(...data);

    if (this.buffer.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Envia buffer acumulado para Supabase. Fire-and-forget.
   */
  flush(): void {
    if (!this.enabled || this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    this.insert('cycle_responses', batch).catch((err) => {
      console.warn(`📊 Falha ao enviar ${batch.length} registros — ${err instanceof Error ? err.message : err}`);
      if (this.buffer.length < 500) {
        this.buffer.unshift(...batch);
      }
    });
  }

  /**
   * Atualiza sessão com ended_at e total_cycles.
   */
  async endSession(sessionId: string, totalCycles: number): Promise<void> {
    if (!this.enabled) return;
    await this.patch('sessions', `id=eq.${sessionId}`, {
      ended_at: new Date().toISOString(),
      total_cycles: totalCycles,
    }).catch((err) =>
      console.warn(`📊 Falha ao finalizar sessão: ${err instanceof Error ? err.message : err}`),
    );
  }

  /**
   * Flush final e cleanup.
   */
  async shutdown(sessionId?: string, totalCycles?: number): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.enabled && this.buffer.length > 0) {
      console.log(`📊 Enviando ${this.buffer.length} registros restantes...`);
      try {
        await this.insert('cycle_responses', this.buffer.splice(0));
      } catch (err) {
        console.warn(`📊 Falha no flush final — ${err instanceof Error ? err.message : err}`);
      }
    }

    if (sessionId && totalCycles !== undefined) {
      await this.endSession(sessionId, totalCycles);
    }
  }

  // ─── Helpers HTTP ────────────────────────────────────────

  private async insert<T extends object>(table: string, rows: T[]): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;

    const url = `${this.supabaseUrl}/rest/v1/${table}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
  }

  private async patch<T extends object>(
    table: string,
    filter: string,
    data: T,
  ): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;

    const url = `${this.supabaseUrl}/rest/v1/${table}?${filter}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
  }
}
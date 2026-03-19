/**
 * DataLogger.ts
 *
 * Envia métricas de cada ciclo do agente para Supabase via REST API.
 * Fire-and-forget: não bloqueia o loop do bot.
 * Se SUPABASE_URL ou SUPABASE_ANON_KEY não estiverem configurados, o logger é inerte.
 *
 * Uso:
 *   Utilizado por AgentLoop para registrar dados de cada ciclo.
 */

export interface CycleData {
  // ─── Sessão ─────────────────────────────────────────────
  session_id: string;
  bot_username: string;
  room_code: string;
  model_selector: string;

  // ─── LLM ────────────────────────────────────────────────
  llm_response_time_ms: number;
  llm_raw_length: number;
  llm_json_repaired: boolean;
  llm_parse_error: boolean;

  // ─── Decisão ────────────────────────────────────────────
  action: string;
  action_success: boolean;
  action_execution_time_ms: number;
  action_error: string | null;
  reasoning: string | null;
  direction: string | null;
  target: string | null;

  // ─── Contexto do Jogo ──────────────────────────────────
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

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 15_000;

export class DataLogger {
  private supabaseUrl: string | null;
  private supabaseKey: string | null;
  private tableName: string;
  private buffer: CycleData[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || null;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY || null;
    this.tableName = process.env.SUPABASE_TABLE || 'bot_cycles';
    this.enabled = !!(this.supabaseUrl && this.supabaseKey);

    if (this.enabled) {
      console.log('📊 DataLogger ativo — enviando métricas para Supabase');
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    } else {
      console.log('📊 DataLogger inativo — configure SUPABASE_URL e SUPABASE_ANON_KEY para coletar dados');
    }
  }

  /**
   * Registra dados de um ciclo. Não bloqueia — acumula em buffer.
   */
  log(data: CycleData): void {
    if (!this.enabled) return;

    this.buffer.push(data);

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

    // Fire-and-forget: não usa await
    this.sendBatch(batch).catch((err) => {
      console.warn(`📊 DataLogger: falha ao enviar ${batch.length} registros — ${err instanceof Error ? err.message : String(err)}`);
      // Devolve pro buffer se falhou (até um limite pra não estourar memória)
      if (this.buffer.length < 200) {
        this.buffer.unshift(...batch);
      }
    });
  }

  /**
   * Envia lote para Supabase REST API.
   */
  private async sendBatch(batch: CycleData[]): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;

    const url = `${this.supabaseUrl}/rest/v1/${this.tableName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
  }

  /**
   * Flush final e cleanup. Chamar no shutdown.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.enabled && this.buffer.length > 0) {
      console.log(`📊 DataLogger: enviando ${this.buffer.length} registros restantes...`);
      try {
        await this.sendBatch(this.buffer.splice(0));
      } catch (err) {
        console.warn(`📊 DataLogger: falha no flush final — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
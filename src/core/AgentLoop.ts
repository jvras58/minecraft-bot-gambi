/**
 * AgentLoop.ts
 *
 * Loop principal do agente com fan-out benchmark.
 *
 * Cada ciclo:
 *   1. Percepção — captura estado do jogo
 *   2. Construção do prompt — monta UMA vez (system + contexto + memória)
 *   3. Fan-out — envia o MESMO prompt para TODOS os participantes em paralelo
 *   4. Parse — valida JSON de TODAS as respostas
 *   5. Seleção — escolhe a resposta mais rápida válida para executar
 *   6. Execução — executa a ação selecionada no jogo
 *   7. Memória — registra o que aconteceu
 *   8. Log — envia TODAS as respostas para Supabase (uma linha por participante)
 */
import type { BotAction, ChatMessage, FanOutResult, GameContext, OnlineParticipant } from '../types/types';
import { BotManager } from '../bot/BotManager';
import { ActionExecutor, type ActionResult } from '../bot/ActionExecutor';
import { PerceptionManager } from '../bot/PerceptionManager';
import { MemoryManager } from './MemoryManager';
import { DataLogger, type CycleResponseData } from './DataLogger';
import { GambiLLM } from '../llm/GambiarraLLM';
import { botActionSchema } from '../schemas/botAction';
import { botPromptTemplate } from '../prompts/botPrompts';
import { sleep } from '../utils/sleep';
import { safeParseJSON } from '../utils/jsonParser';
import { agentConfig } from '../config/settings';

/** Resposta parseada de um participante */
interface ParsedResponse {
  participantId: string;
  nickname: string;
  modelName: string;
  action: BotAction | null;
  responseTimeMs: number;
  rawLength: number;
  rawResponse: string;
  jsonRepaired: boolean;
  parseError: boolean;
  llmError: string | null;
}

export class AgentLoop {
  private botManager: BotManager;
  private llm: GambiLLM;
  private executor: ActionExecutor | null = null;
  private perception: PerceptionManager | null = null;
  private memory: MemoryManager;
  private logger: DataLogger;
  private isRunning = false;
  private listenersAttached = false;

  // Identificadores
  private sessionId: string;
  private botUsername: string;
  private roomCode: string;
  private cycleNumber = 0;

  // Cache de participantes (atualizado periodicamente)
  private participants: OnlineParticipant[] = [];
  private lastParticipantRefresh = 0;
  private readonly PARTICIPANT_REFRESH_INTERVAL = 30_000; // 30s

  constructor(botManager: BotManager, llm: GambiLLM, options: {
    roomCode: string;
    botUsername: string;
  }) {
    this.botManager = botManager;
    this.llm = llm;
    this.memory = new MemoryManager();
    this.logger = new DataLogger();

    this.sessionId = crypto.randomUUID();
    this.botUsername = options.botUsername;
    this.roomCode = options.roomCode;

    this.botManager.setCallbacks(
      () => this.onConnected(),
      () => this.onDisconnected(),
    );
  }

  async start(): Promise<void> {
    console.log('🧠 Agente ativado (modo fan-out benchmark)');
    console.log(`📊 Session ID: ${this.sessionId}`);

    // Captura participantes e specs iniciais
    await this.refreshParticipants();

    if (this.participants.length === 0) {
      console.warn('⚠️  Nenhum participante online — o bot vai esperar até alguém entrar');
    } else {
      console.log(`\n🖥️  Participantes online (${this.participants.length}):`);
      for (const p of this.participants) {
        const gpu = p.specs?.gpu ?? '?';
        const ram = p.specs?.ram ?? '?';
        console.log(`   ${p.nickname} — ${p.model} (GPU: ${gpu}, RAM: ${ram})`);
      }
      console.log('');
    }

    // Registra sessão e specs no Supabase
    await this.logger.logSession({
      id: this.sessionId,
      room_code: this.roomCode,
      bot_username: this.botUsername,
      participant_count: this.participants.length,
    });
    await this.logger.logParticipantSnapshots(this.sessionId, this.participants);

    this.isRunning = true;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.logger.shutdown(this.sessionId, this.cycleNumber);
  }

  // ─── Loop Principal ──────────────────────────────────────

  private async loop(): Promise<void> {
    while (this.isRunning) {
      if (!this.botManager.isConnected() || !this.executor || !this.perception) {
        await sleep(agentConfig.disconnectedWaitMs);
        continue;
      }

      try {
        // Atualiza lista de participantes periodicamente
        await this.maybeRefreshParticipants();

        if (this.participants.length === 0) {
          console.log('⏳ Aguardando participantes...');
          await sleep(5000);
          continue;
        }

        this.cycleNumber++;
        console.log(`\n━━━ Ciclo #${this.cycleNumber} (${this.participants.length} participantes) ━━━`);

        // 1. PERCEPÇÃO
        const contexto = this.perception.getContextString();
        const gameCtx = this.perception.getGameContext();

        // 2. CONSTRUÇÃO DO PROMPT (uma vez só)
        const messages = this.buildMessages(contexto);

        // 3. FAN-OUT — mesmo prompt pra todos
        console.log('📡 Enviando prompt para todos os participantes...');
        const fanOutResults = await this.llm.invokeAll(messages, this.participants);

        // 4. PARSE de todas as respostas
        const parsed = fanOutResults.map((r) => this.parseResponse(r));

        // Log resumido
        for (const p of parsed) {
          const status = p.llmError
            ? `❌ ${p.llmError.slice(0, 50)}`
            : p.parseError
              ? `⚠️  JSON inválido`
              : `✅ ${p.action?.acao ?? '?'} (${p.responseTimeMs.toFixed(0)}ms)`;
          console.log(`   ${p.nickname} [${p.modelName}]: ${status}`);
        }

        // 5. SELEÇÃO — mais rápida válida
        const selected = this.selectBest(parsed);

        if (!selected) {
          console.warn('⚠️  Nenhuma resposta válida — fallback EXPLORAR');
          const fallback: BotAction = { raciocinio: 'Fallback: sem resposta válida', acao: 'EXPLORAR' };
          await this.executor.executar(fallback);
          this.memory.recordEvent('Nenhum participante retornou JSON válido');
          await sleep(agentConfig.loopIntervalMs);
          continue;
        }

        console.log(`🏆 Selecionado: ${selected.nickname} [${selected.modelName}] — ${selected.action!.acao} (${selected.responseTimeMs.toFixed(0)}ms)`);

        if (selected.action!.raciocinio) {
          console.log(`💭 Raciocínio: ${selected.action!.raciocinio}`);
        }

        // 6. EXECUÇÃO
        const actionResult = await this.executor.executar(selected.action!);

        // 7. MEMÓRIA
        this.memory.recordAction(
          actionResult.action,
          actionResult.success,
          actionResult.direction || actionResult.content || undefined,
        );

        if (!actionResult.success) {
          console.log(`⚠️  ${actionResult.action} falhou: ${actionResult.errorMessage}`);
        }

        // 8. LOG — todas as respostas, marcando qual foi executada
        this.logAllResponses(parsed, selected, actionResult, gameCtx);

        await sleep(agentConfig.loopIntervalMs);
      } catch (err) {
        console.error('❌ Erro no loop:', err);
        await sleep(5000);
      }
    }
  }

  // ─── Construção do Prompt ────────────────────────────────

  private buildMessages(contexto: string): ChatMessage[] {
    const humanMsg = botPromptTemplate.human
      .replace('{contexto}', contexto)
      .replace('{memoria}', this.memory.toPromptString())
      .replace('{contadorAcoes}', JSON.stringify(this.memory.getActionCounts()));

    return [
      { role: 'system', content: botPromptTemplate.system },
      { role: 'user', content: humanMsg },
    ];
  }

  // ─── Parse de Resposta ───────────────────────────────────

  private parseResponse(result: FanOutResult): ParsedResponse {
    if (result.error || !result.response) {
      return {
        participantId: result.participantId,
        nickname: result.nickname,
        modelName: result.modelName,
        action: null,
        responseTimeMs: result.response?.responseTimeMs ?? 0,
        rawLength: 0,
        rawResponse: '',
        jsonRepaired: false,
        parseError: false,
        llmError: result.error,
      };
    }

    const { data, error, repaired } = safeParseJSON(result.response.content);

    if (!data || error) {
      return {
        participantId: result.participantId,
        nickname: result.nickname,
        modelName: result.modelName,
        action: null,
        responseTimeMs: result.response.responseTimeMs,
        rawLength: result.response.content.length,
        rawResponse: result.response.content.slice(0, 500),
        jsonRepaired: false,
        parseError: true,
        llmError: null,
      };
    }

    try {
      const action = botActionSchema.parse(data);
      return {
        participantId: result.participantId,
        nickname: result.nickname,
        modelName: result.modelName,
        action,
        responseTimeMs: result.response.responseTimeMs,
        rawLength: result.response.content.length,
        rawResponse: result.response.content.slice(0, 500),
        jsonRepaired: repaired,
        parseError: false,
        llmError: null,
      };
    } catch {
      return {
        participantId: result.participantId,
        nickname: result.nickname,
        modelName: result.modelName,
        action: null,
        responseTimeMs: result.response.responseTimeMs,
        rawLength: result.response.content.length,
        rawResponse: result.response.content.slice(0, 500),
        jsonRepaired: repaired,
        parseError: true,
        llmError: null,
      };
    }
  }

  // ─── Seleção da Melhor Resposta ──────────────────────────

  private selectBest(parsed: ParsedResponse[]): ParsedResponse | null {
    const valid = parsed.filter((p) => p.action !== null && !p.llmError && !p.parseError);

    if (valid.length === 0) return null;

    if (agentConfig.selectionStrategy === 'random') {
      return valid[Math.floor(Math.random() * valid.length)]!;
    }

    // 'fastest' — menor latência
    return valid.reduce((best, curr) =>
      curr.responseTimeMs < best.responseTimeMs ? curr : best,
    );
  }

  // ─── Log de Todas as Respostas ───────────────────────────

  private logAllResponses(
    parsed: ParsedResponse[],
    selected: ParsedResponse,
    actionResult: ActionResult,
    gameCtx: GameContext,
  ): void {
    const rows: CycleResponseData[] = parsed.map((p) => {
      const isSelected = p.participantId === selected.participantId;

      return {
        session_id: this.sessionId,
        cycle_number: this.cycleNumber,
        room_code: this.roomCode,

        participant_id: p.participantId,
        participant_nickname: p.nickname,
        model_name: p.modelName,

        llm_response_time_ms: p.responseTimeMs || null,
        llm_raw_length: p.rawLength || null,
        llm_json_repaired: p.jsonRepaired,
        llm_parse_error: p.parseError,
        llm_error: p.llmError,

        action: p.action?.acao ?? null,
        reasoning: p.action?.raciocinio ?? null,
        direction: p.action?.direcao ?? null,
        target: p.action?.alvo ?? null,
        content: p.action?.conteudo ?? null,
        raw_response: p.rawResponse ?? null,

        was_executed: isSelected,
        action_success: isSelected ? actionResult.success : null,
        action_execution_time_ms: isSelected ? actionResult.executionTimeMs : null,
        action_error: isSelected ? (actionResult.errorMessage ?? null) : null,

        health: gameCtx.vida,
        food: gameCtx.fome,
        pos_x: gameCtx.posicao.x,
        pos_y: gameCtx.posicao.y,
        pos_z: gameCtx.posicao.z,
        biome: gameCtx.bioma,
        weather: gameCtx.clima,
        time_of_day: gameCtx.horaDoDia,
        is_moving: gameCtx.estaAndando,
        nearby_players: gameCtx.jogadoresProximos.length,
        nearby_entities: gameCtx.entidadesProximas.length,
        nearby_blocks: gameCtx.blocosProximos.length,
        inventory_items: gameCtx.inventario.length,
      };
    });

    this.logger.log(rows);
  }

  // ─── Refresh de Participantes ────────────────────────────

  private async refreshParticipants(): Promise<void> {
    try {
      this.participants = await this.llm.getOnlineParticipants();
      this.lastParticipantRefresh = Date.now();
    } catch (err) {
      console.warn('⚠️  Falha ao listar participantes:', err instanceof Error ? err.message : err);
    }
  }

  private async maybeRefreshParticipants(): Promise<void> {
    if (Date.now() - this.lastParticipantRefresh > this.PARTICIPANT_REFRESH_INTERVAL) {
      const before = this.participants.length;
      await this.refreshParticipants();
      const after = this.participants.length;

      if (after !== before) {
        console.log(`🔄 Participantes atualizados: ${before} → ${after}`);
        // Se novos participantes entraram, registra specs deles
        if (after > before) {
          await this.logger.logParticipantSnapshots(this.sessionId, this.participants);
        }
      }
    }
  }

  // ─── Callbacks de Conexão ────────────────────────────────

  private onConnected(): void {
    const bot = this.botManager.getBot();
    if (!bot) return;

    this.executor = new ActionExecutor(bot);
    this.perception = new PerceptionManager(bot);

    if (!this.listenersAttached) {
      this.listenersAttached = true;
      this.memory.clear();
      this.memory.recordEvent('Conectado ao servidor');

      bot.on('chat', (user, msg) => {
        if (user === bot.username) return;
        this.memory.recordInteraction(user, msg);
      });

      bot.on('health', () => {
        if (bot.health < 8) {
          this.memory.recordEvent(`Vida baixa: ${bot.health.toFixed(0)}/20`);
        }
      });

      bot.on('death', () => {
        this.memory.recordEvent('Morri! Respawnando...');
      });
    } else {
      this.memory.recordEvent('Respawnei');
    }
  }

  private onDisconnected(): void {
    this.executor = null;
    this.perception = null;
    this.listenersAttached = false;
  }
}
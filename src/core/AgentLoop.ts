/**
 * AgentLoop.ts
 *
 * Orquestra o ciclo principal do agente: percepção → memória → raciocínio (LLM) → ação → log.
 * Responsável por integrar bot, LLM, executor, percepção, memória e data logger.
 *
 * Principais classes:
 *   - AgentLoop: ciclo de decisão, integração de módulos, controle de execução.
 *
 * Extensão:
 *   - Customizar ciclo, adicionar hooks, novos passos ou lógica de decisão.
 *
 * Uso:
 *   Utilizado como loop central do bot, chamado pelo index.ts.
 */
import type { BotAction, ChatMessage } from '../types/types';
import { BotManager } from '../bot/BotManager';
import { ActionExecutor, type ActionResult } from '../bot/ActionExecutor';
import { PerceptionManager } from '../bot/PerceptionManager';
import { MemoryManager } from './MemoryManager';
import { DataLogger, type CycleData } from './DataLogger';
import { GambiLLM } from '../llm/GambiarraLLM';
import { botActionSchema } from '../schemas/botAction';
import { botPromptTemplate } from '../prompts/botPrompts';
import { sleep } from '../utils/sleep';
import { safeParseJSON } from '../utils/jsonParser';
import { agentConfig } from '../config/settings';

/** Resultado intermediário do raciocínio pra passar pro logger */
interface ThinkResult {
  action: BotAction;
  responseTimeMs: number;
  rawLength: number;
  jsonRepaired: boolean;
  parseError: boolean;
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

  // Identificadores pra correlacionar dados
  private sessionId: string;
  private botUsername: string;
  private roomCode: string;
  private modelSelector: string;

  constructor(botManager: BotManager, llm: GambiLLM, options: {
    roomCode: string;
    botUsername: string;
    modelSelector: string;
  }) {
    this.botManager = botManager;
    this.llm = llm;
    this.memory = new MemoryManager();
    this.logger = new DataLogger();

    this.sessionId = crypto.randomUUID();
    this.botUsername = options.botUsername;
    this.roomCode = options.roomCode;
    this.modelSelector = options.modelSelector;

    this.botManager.setCallbacks(
      () => this.onConnected(),
      () => this.onDisconnected(),
    );
  }

  start(): void {
    console.log('🧠 Agente ativado (via Gambiarra Hub)');
    console.log(`📊 Session ID: ${this.sessionId}`);
    this.isRunning = true;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
  }

  /** Flush de métricas pendentes antes de sair. */
  async shutdown(): Promise<void> {
    this.stop();
    await this.logger.shutdown();
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      if (!this.botManager.isConnected() || !this.executor || !this.perception) {
        await sleep(agentConfig.disconnectedWaitMs);
        continue;
      }

      try {
        // 1. PERCEPÇÃO
        const contexto = this.perception.getContextString();
        const gameCtx = this.perception.getGameContext();

        // 2. RACIOCÍNIO (LLM via Gambiarra)
        const thinkResult = await this.pensar(contexto);
        if (!thinkResult || !this.botManager.isConnected()) continue;

        const decisao = thinkResult.action;

        // Log do raciocínio
        if (decisao.raciocinio) {
          console.log(`💭 Raciocínio: ${decisao.raciocinio}`);
        }

        // 3. AÇÃO
        const result = await this.executor.executar(decisao);

        // 4. MEMÓRIA
        this.memory.recordAction(
          result.action,
          result.success,
          result.direction || result.content || undefined,
        );

        if (!result.success) {
          console.log(`⚠️  ${result.action} falhou: ${result.errorMessage}`);
        }

        // 5. LOG DE MÉTRICAS (fire-and-forget)
        this.logCycle(thinkResult, result, decisao, gameCtx);

        await sleep(agentConfig.loopIntervalMs);
      } catch (err) {
        console.error('❌ Erro no loop:', err);
        await sleep(5000);
      }
    }
  }

  private logCycle(
    think: ThinkResult,
    result: ActionResult,
    action: BotAction,
    gameCtx: {
      vida: number;
      fome: number;
      posicao: { x: number; y: number; z: number };
      bioma: string;
      clima: string;
      horaDoDia: number;
      estaAndando: boolean;
      jogadoresProximos: string[];
      entidadesProximas: unknown[];
      blocosProximos: unknown[];
      inventario: unknown[];
    },
  ): void {
    const data: CycleData = {
      // Sessão
      session_id: this.sessionId,
      bot_username: this.botUsername,
      room_code: this.roomCode,
      model_selector: this.modelSelector,

      // LLM
      llm_response_time_ms: think.responseTimeMs,
      llm_raw_length: think.rawLength,
      llm_json_repaired: think.jsonRepaired,
      llm_parse_error: think.parseError,

      // Decisão
      action: result.action,
      action_success: result.success,
      action_execution_time_ms: result.executionTimeMs,
      action_error: result.errorMessage ?? null,
      reasoning: action.raciocinio ?? null,
      direction: action.direcao ?? null,
      target: action.alvo ?? null,

      // Contexto do jogo
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

    this.logger.log(data);
  }

  private async pensar(contexto: string): Promise<ThinkResult | null> {
    if (!this.botManager.isConnected()) return null;

    try {
      const humanMsg = botPromptTemplate.human
        .replace('{contexto}', contexto)
        .replace('{memoria}', this.memory.toPromptString())
        .replace('{contadorAcoes}', JSON.stringify(this.memory.getActionCounts()));

      const messages: ChatMessage[] = [
        { role: 'system', content: botPromptTemplate.system },
        { role: 'user', content: humanMsg },
      ];

      const response = await this.llm.invoke(messages);

      console.log(`⏱️  LLM respondeu em ${response.responseTimeMs.toFixed(0)}ms`);

      const { data, error, repaired } = safeParseJSON(response.content);

      if (!data || error) {
        console.warn(`⚠️  JSON inválido da LLM: ${error}`);
        console.warn(`   Resposta bruta: ${response.content.slice(0, 200)}`);
        this.memory.recordEvent('LLM retornou JSON inválido — fallback');
        return {
          action: { raciocinio: 'Fallback: JSON inválido', acao: 'EXPLORAR' },
          responseTimeMs: response.responseTimeMs,
          rawLength: response.content.length,
          jsonRepaired: false,
          parseError: true,
        };
      }

      if (repaired) {
        console.log('🔧 JSON da LLM precisou de reparo (jsonrepair)');
      }

      const parsed = botActionSchema.parse(data);

      return {
        action: parsed,
        responseTimeMs: response.responseTimeMs,
        rawLength: response.content.length,
        jsonRepaired: repaired,
        parseError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Erro no raciocínio:', msg);
      this.memory.recordEvent(`Erro no raciocínio: ${msg}`);
      return {
        action: { raciocinio: 'Fallback por erro', acao: 'EXPLORAR' },
        responseTimeMs: 0,
        rawLength: 0,
        jsonRepaired: false,
        parseError: true,
      };
    }
  }

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
/**
 * AgentLoop.ts
 *
 * Orquestra o ciclo principal do agente: percepção → memória → raciocínio (LLM) → ação.
 * Responsável por integrar bot, LLM, executor, percepção e memória, garantindo decisões autônomas.
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
import { ActionExecutor } from '../bot/ActionExecutor';
import { PerceptionManager } from '../bot/PerceptionManager';
import { MemoryManager } from './MemoryManager';
import { GambiLLM } from '../llm/GambiarraLLM';
import { botActionSchema } from '../schemas/botAction';
import { botPromptTemplate } from '../prompts/botPrompts';
import { sleep } from '../utils/sleep';
import { safeParseJSON } from '../utils/jsonParser';
import { agentConfig } from '../config/settings';

/**
 * Loop principal do agente: Percepção → Memória → Raciocínio → Ação.
 *
 * Agora usa GambiarraLLM para enviar requests ao hub Gambiarra,
 * que roteia para qualquer LLM disponível na sala.
 */
export class AgentLoop {
  private botManager: BotManager;
  private llm: GambiLLM;
  private executor: ActionExecutor | null = null;
  private perception: PerceptionManager | null = null;
  private memory: MemoryManager;
  private isRunning = false;
  private listenersAttached = false;

  constructor(botManager: BotManager, llm: GambiLLM) {
    this.botManager = botManager;
    this.llm = llm;
    this.memory = new MemoryManager();

    this.botManager.setCallbacks(
      () => this.onConnected(),
      () => this.onDisconnected(),
    );
  }

  start(): void {
    console.log('🧠 Agente ativado (via Gambiarra Hub)');
    this.isRunning = true;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
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

        // 2. RACIOCÍNIO (LLM via Gambiarra)
        const decisao = await this.pensar(contexto);
        if (!decisao || !this.botManager.isConnected()) continue;

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

        await sleep(agentConfig.loopIntervalMs);
      } catch (err) {
        console.error('❌ Erro no loop:', err);
        await sleep(5000);
      }
    }
  }

  private async pensar(contexto: string): Promise<BotAction | null> {
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
        return { raciocinio: 'Fallback: JSON inválido', acao: 'EXPLORAR' };
      }

      if (repaired) {
        console.log('🔧 JSON da LLM precisou de reparo (jsonrepair)');
      }

      return botActionSchema.parse(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Erro no raciocínio:', msg);
      this.memory.recordEvent(`Erro no raciocínio: ${msg}`);
      return { raciocinio: 'Fallback por erro', acao: 'EXPLORAR' };
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

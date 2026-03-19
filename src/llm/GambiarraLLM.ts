/**
 * GambiarraLLM.ts
 *
 * Cliente para Gambi Hub, roteia requests para LLMs disponíveis na sala.
 * Permite selecionar modelo, enviar mensagens e obter respostas de IA.
 *
 * Principais classes:
 *   - GambiLLM: integra SDK Gambi, resolve modelo, envia prompts e retorna respostas.
 *
 * Extensão:
 *   - Adicionar suporte a novos protocolos ou modelos de IA.
 *
 * Uso:
 *   Utilizado por AgentLoop para raciocínio/autonomia do bot.
 */
import { createGambi, type GambiProvider } from 'gambi-sdk';
import { generateText } from 'ai';
import type { ChatMessage, LLMResponse } from '../types/types';

export interface GambiLLMOptions {
  /** Código da sala */
  roomCode: string;
  /** URL do hub (default: http://localhost:3000) */
  hubUrl?: string;
  /** Modelo a usar ("*" = qualquer, ou nome do modelo/participante) */
  model?: string;
}

/**
 * Cliente LLM que usa o SDK Gambi + Vercel AI SDK.
 *
 * Roteia automaticamente para participantes online na sala:
 *   "*"          → gambi.any()           (qualquer participante)
 *   "llama3"     → gambi.model(...)      (primeiro com esse modelo)
 *   "joao-4090"  → gambi.participant(...) (participante específico)
 */
export class GambiLLM {
  private provider: GambiProvider;
  private modelSelector: string;

  constructor(options: GambiLLMOptions) {
    this.modelSelector = options.model ?? '*';

    this.provider = createGambi({
      roomCode: options.roomCode,
      hubUrl: options.hubUrl ?? 'http://localhost:3000',
      defaultProtocol: 'chatCompletions',
    });
  }

  /** Resolve qual model do AI SDK usar baseado no --model passado. */
  private getModel() {
    if (this.modelSelector === '*' || this.modelSelector === 'any') {
      return this.provider.any();
    }

    // "participant:joao" → rota direta para participante
    if (this.modelSelector.startsWith('participant:')) {
      return this.provider.participant(this.modelSelector.slice(12));
    }

    // Qualquer outra string → tenta como nome de modelo
    return this.provider.model(this.modelSelector);
  }

  /**
   * Envia mensagens para o hub via AI SDK e retorna a resposta.
   */
  async invoke(messages: ChatMessage[]): Promise<LLMResponse> {
    const start = performance.now();

    // Separa system prompt das mensagens de conversa
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role !== 'system');

    const result = await generateText({
      model: this.getModel(),
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.8,
    });

    const responseTimeMs = performance.now() - start;

    return {
      content: result.text,
      responseTimeMs,
    };
  }

  /** Verifica se o hub está acessível e a sala tem participantes. */
  async healthCheck(): Promise<{ ok: boolean; participants: number }> {
    try {
      const models = await this.provider.listModels();
      return { ok: models.length > 0, participants: models.length };
    } catch {
      return { ok: false, participants: 0 };
    }
  }
}

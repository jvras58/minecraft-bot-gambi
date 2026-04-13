/**
 * GambiarraLLM.ts
 *
 * Cliente para Gambi Hub com suporte a fan-out.
 * Envia o mesmo prompt para TODOS os participantes em paralelo,
 * retornando as respostas individuais para comparação.
 */
import { createGambi, type GambiProvider } from 'gambi-sdk';
import { generateText } from 'ai';
import type { ChatMessage, LLMResponse, FanOutResult, OnlineParticipant } from '@/types/types';
import { agentConfig } from '@/config/settings';

export interface GambiLLMOptions {
  roomCode: string;
  hubUrl?: string;
}

export class GambiLLM {
  private provider: GambiProvider;

  constructor(options: GambiLLMOptions) {
    this.provider = createGambi({
      roomCode: options.roomCode,
      hubUrl: options.hubUrl ?? 'http://localhost:3000',
      defaultProtocol: 'chatCompletions',
    });
  }

  /**
   * Lista participantes online com suas specs de hardware.
   */
  async getOnlineParticipants(): Promise<OnlineParticipant[]> {
    try {
      const participants = await this.provider.listParticipants();
      return participants
        .filter((p) => p.status === 'online')
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          model: p.model,
          endpoint: p.endpoint,
          specs: p.specs ? { ...p.specs } : undefined,
        }));
    } catch (err) {
      // Fallback: tenta listModels se listParticipants falhar
      console.warn('⚠️  listParticipants falhou, tentando listModels...');
      const models = await this.provider.listModels();
      return models.map((m) => ({
        id: m.id,
        nickname: m.nickname,
        model: m.model,
        endpoint: m.endpoint,
      }));
    }
  }

  /**
   * Fan-out: envia o MESMO prompt para TODOS os participantes em paralelo.
   * Cada chamada é independente — se uma falha, as outras continuam.
   */
  async invokeAll(
    messages: ChatMessage[],
    participants: OnlineParticipant[],
  ): Promise<FanOutResult[]> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role !== 'system');

    const tasks = participants.map(async (p): Promise<FanOutResult> => {
      try {
        const model = this.provider.participant(p.id);
        const start = performance.now();

        const result = await Promise.race([
          generateText({
            model,
            system: systemMsg?.content,
            messages: userMsgs.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            temperature: 0.8,
          }),
          this.timeout(agentConfig.fanOutTimeoutMs),
        ]);

        const responseTimeMs = performance.now() - start;

        return {
          participantId: p.id,
          nickname: p.nickname,
          modelName: p.model,
          response: {
            content: (result as any).text,
            responseTimeMs,
          },
          error: null,
        };
      } catch (err) {
        return {
          participantId: p.id,
          nickname: p.nickname,
          modelName: p.model,
          response: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    return Promise.all(tasks);
  }

  /**
   * Invocação simples para um único participante (fallback/debug).
   */
  async invoke(
    messages: ChatMessage[],
    participantId: string,
  ): Promise<LLMResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role !== 'system');

    const start = performance.now();
    const result = await generateText({
      model: this.provider.participant(participantId),
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.8,
    });

    return {
      content: result.text,
      responseTimeMs: performance.now() - start,
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

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms),
    );
  }
}
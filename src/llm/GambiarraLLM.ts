/** Cliente Gambi Hub com fan-out para todos os participantes. */
import { createGambi, type GambiProvider } from 'gambi-sdk';
import { generateText } from 'ai';
import type { ChatMessage, FanOutResult, OnlineParticipant } from '@/types/types';
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
    } catch {
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

  async invokeAll(
    messages: ChatMessage[],
    participants: OnlineParticipant[],
  ): Promise<FanOutResult[]> {
    const { system, userMessages } = this.splitMessages(messages);

    const tasks = participants.map(async (p): Promise<FanOutResult> => {
      try {
        const start = performance.now();
        const result = await Promise.race([
          generateText({
            model: this.provider.participant(p.id),
            system,
            messages: userMessages,
            temperature: 0.8,
          }),
          this.timeout(agentConfig.fanOutTimeoutMs),
        ]);

        return {
          participantId: p.id,
          nickname: p.nickname,
          modelName: p.model,
          response: { content: (result as any).text, responseTimeMs: performance.now() - start },
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

  async healthCheck(): Promise<{ ok: boolean; participants: number }> {
    try {
      const models = await this.provider.listModels();
      return { ok: models.length > 0, participants: models.length };
    } catch {
      return { ok: false, participants: 0 };
    }
  }

  private splitMessages(messages: ChatMessage[]) {
    return {
      system: messages.find((m) => m.role === 'system')?.content,
      userMessages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    };
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms),
    );
  }
}
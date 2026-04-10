/**
 * gambi-sdk.d.ts
 *
 * Declaração de tipos para o SDK Gambi.
 * Tipagem para integração com hub, participantes, specs e roteamento.
 */
declare module 'gambi-sdk' {
  export interface ParticipantSpecs {
    cpu?: string;
    ram?: string;
    gpu?: string;
    vram?: string;
    os?: string;
    [key: string]: unknown;
  }

  export interface ParticipantInfo {
    id: string;
    nickname: string;
    model: string;
    endpoint: string;
    status: 'online' | 'offline';
    specs?: ParticipantSpecs;
    config?: Record<string, unknown>;
  }

  export interface GambiModel {
    id: string;
    nickname: string;
    model: string;
    endpoint: string;
    capabilities: {
      openResponses: string;
      chatCompletions: string;
    };
  }

  export interface GambiProvider {
    any(): any;
    participant(id: string): any;
    model(name: string): any;
    listModels(): Promise<GambiModel[]>;
    listParticipants(): Promise<ParticipantInfo[]>;
    baseURL: string;
  }

  export interface CreateGambiOptions {
    roomCode: string;
    hubUrl?: string;
    defaultProtocol?: 'openResponses' | 'chatCompletions';
  }

  export function createGambi(options: CreateGambiOptions): GambiProvider;
}
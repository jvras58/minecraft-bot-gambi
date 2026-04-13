/** Ring buffer de memória de curto prazo do bot. */
import type { MemoryEntry } from '@/types/types';
import { agentConfig } from '@/config/settings';

export class MemoryManager {
  private entries: MemoryEntry[] = [];
  private maxSize: number;

  constructor(maxSize?: number) {
    this.maxSize = maxSize ?? agentConfig.shortTermMemorySize;
  }

  add(
    tipo: MemoryEntry['tipo'],
    resumo: string,
    dados?: Record<string, unknown>,
  ): void {
    const acao = dados?.acao as string | undefined;
    this.entries.push({ timestamp: Date.now(), tipo, resumo, acao, dados });
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  recordAction(acao: string, sucesso: boolean, detalhe?: string): void {
    const status = sucesso ? '✓' : '✗';
    this.add('acao', `[${status}] ${acao}${detalhe ? ': ' + detalhe : ''}`, { acao });
  }

  recordEvent(evento: string): void {
    this.add('evento', evento);
  }

  recordObservation(obs: string): void {
    this.add('observacao', obs);
  }

  recordInteraction(jogador: string, mensagem: string): void {
    this.add('interacao', `${jogador} disse: "${mensagem}"`);
  }

  toPromptString(): string {
    if (this.entries.length === 0) return 'Nenhum evento recente.';

    return this.entries
      .map((e) => {
        const age = Math.round((Date.now() - e.timestamp) / 1000);
        return `[${age}s atrás] ${e.resumo}`;
      })
      .join('\n');
  }

  getActionCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.entries) {
      if (e.tipo === 'acao' && e.acao) {
        counts[e.acao] = (counts[e.acao] || 0) + 1;
      }
    }
    return counts;
  }

  hasRecentInteraction(segundos: number = 30): boolean {
    const cutoff = Date.now() - segundos * 1000;
    return this.entries.some(
      (e) => e.tipo === 'interacao' && e.timestamp > cutoff,
    );
  }

  clear(): void {
    this.entries = [];
  }
}

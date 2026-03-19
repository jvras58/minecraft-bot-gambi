/**
 * MemoryManager.ts
 *
 * Gerencia memória de curto prazo do bot (eventos, ações, interações).
 * Implementa ring buffer em memória, sem persistência.
 *
 * Principais classes:
 *   - MemoryManager: métodos para registrar eventos, ações, observações e gerar prompt.
 *
 * Extensão:
 *   - Expandir tipos de memória, persistência, integração com memória longa.
 *
 * Uso:
 *   Utilizado por AgentLoop para fornecer contexto recente ao LLM.
 */
import type { MemoryEntry } from '../types/types';
import { agentConfig } from '../config/settings';

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
    this.entries.push({ timestamp: Date.now(), tipo, resumo, dados });
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  recordAction(acao: string, sucesso: boolean, detalhe?: string): void {
    const status = sucesso ? '✓' : '✗';
    this.add('acao', `[${status}] ${acao}${detalhe ? ': ' + detalhe : ''}`);
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
      if (e.tipo !== 'acao') continue;
        const match = e.resumo.match(/\[.\] (\w+)/);
        if (match && typeof match[1] !== 'undefined') {
          counts[match[1]] = (counts[match[1]] || 0) + 1;
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

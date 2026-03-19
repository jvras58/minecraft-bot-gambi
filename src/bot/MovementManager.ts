/**
 * MovementManager.ts
 *
 * Controla movimentação do bot Minecraft (andar, explorar, seguir, fugir).
 * Responsável por traduzir comandos de movimento em ações mineflayer.
 *
 * Principais classes:
 *   - MovementManager: métodos para movimentação, controle de direção, interação com entidades.
 *
 * Extensão:
 *   - Adicionar novas estratégias de movimento ou lógica de pathfinding.
 *
 * Uso:
 *   Utilizado por ActionExecutor e BotManager para movimentação do bot.
 */
import type { Bot, ControlState } from 'mineflayer';

export class MovementManager {
  private bot: Bot;
  private moveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  andarNaDirecao(direcao: string): void {
    this.pararMovimento();

    const map: Record<string, ControlState> = {
      frente: 'forward',
      tras: 'back',
      esquerda: 'left',
      direita: 'right',
    };

    if (direcao === 'aleatorio') {
      const dirs: ControlState[] = ['forward', 'back', 'left', 'right'];
      this.bot.setControlState(dirs[Math.floor(Math.random() * dirs.length)]!, true);
    } else {
      const ctrl = map[direcao];
      if (ctrl) this.bot.setControlState(ctrl, true);
    }

    this.autoStop(2000 + Math.random() * 2000);
  }

  explorarAleatorio(): void {
    this.pararMovimento();

    const dirs: ControlState[] = ['forward', 'back', 'left', 'right'];
    this.bot.setControlState(dirs[Math.floor(Math.random() * dirs.length)]!, true);
    this.bot.look(Math.random() * Math.PI * 2, 0);

    this.autoStop(3000 + Math.random() * 3000);
  }

  seguirJogador(nome: string): void {
    this.pararMovimento();

    const player = this.bot.players[nome];
    if (!player?.entity) {
      throw new Error(`Jogador ${nome} não encontrado ou fora do alcance`);
    }

    this.bot.lookAt(player.entity.position.offset(0, 1.6, 0));
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);

    this.autoStop(3000);
  }

  fugirDeEntidade(nome: string): void {
    this.pararMovimento();

    const entity = Object.values(this.bot.entities).find(
      (e) =>
        e.username === nome ||
        e.displayName === nome ||
        `entity_${e.id}` === nome,
    );

    if (entity) {
      const dx = this.bot.entity.position.x - entity.position.x;
      const dz = this.bot.entity.position.z - entity.position.z;
      const yaw = Math.atan2(-dx, dz);
      this.bot.look(yaw, 0);
    }

    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);

    this.autoStop(4000);
  }

  pararMovimento(): void {
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }
    this.bot.setControlState('forward', false);
    this.bot.setControlState('back', false);
    this.bot.setControlState('left', false);
    this.bot.setControlState('right', false);
    this.bot.setControlState('sprint', false);
  }

  async pular(): Promise<void> {
    this.bot.setControlState('jump', true);
    await new Promise((r) => setTimeout(r, 100));
    this.bot.setControlState('jump', false);
  }

  private autoStop(ms: number): void {
    this.moveTimeout = setTimeout(() => this.pararMovimento(), ms);
  }
}

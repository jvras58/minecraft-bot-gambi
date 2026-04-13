/** Controla movimentação do bot (andar, seguir, fugir, explorar). */
import type { Bot, ControlState } from 'mineflayer';

const DIRECTION_MAP: Record<string, ControlState> = {
  frente: 'forward',
  tras: 'back',
  esquerda: 'left',
  direita: 'right',
};

const ALL_DIRS: ControlState[] = ['forward', 'back', 'left', 'right'];

export class MovementManager {
  private bot: Bot;
  private moveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  andarNaDirecao(direcao: string): void {
    this.pararMovimento();

    if (direcao === 'aleatorio') {
      this.bot.setControlState(ALL_DIRS[Math.floor(Math.random() * ALL_DIRS.length)]!, true);
    } else {
      const ctrl = DIRECTION_MAP[direcao];
      if (ctrl) this.bot.setControlState(ctrl, true);
    }

    this.autoStop(2000 + Math.random() * 2000);
  }

  explorarAleatorio(): void {
    this.pararMovimento();
    this.bot.setControlState(ALL_DIRS[Math.floor(Math.random() * ALL_DIRS.length)]!, true);
    this.bot.look(Math.random() * Math.PI * 2, 0);
    this.autoStop(3000 + Math.random() * 3000);
  }

  seguirJogador(nome: string): void {
    this.pararMovimento();
    const player = this.bot.players[nome];
    if (!player?.entity) throw new Error(`Jogador ${nome} não encontrado ou fora do alcance`);

    this.bot.lookAt(player.entity.position.offset(0, 1.6, 0));
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
    this.autoStop(3000);
  }

  fugirDeEntidade(nome: string): void {
    this.pararMovimento();

    const entity = Object.values(this.bot.entities).find(
      (e) => e.username === nome || e.displayName === nome || `entity_${e.id}` === nome,
    );

    if (entity) {
      const dx = this.bot.entity.position.x - entity.position.x;
      const dz = this.bot.entity.position.z - entity.position.z;
      this.bot.look(Math.atan2(-dx, dz), 0);
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
    for (const dir of ALL_DIRS) this.bot.setControlState(dir, false);
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

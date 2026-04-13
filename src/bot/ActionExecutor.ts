/**
 * ActionExecutor.ts
 *
 * Executa ações do bot Minecraft baseadas em decisões da IA.
 * Responsável por traduzir decisões em comandos mineflayer (andar, falar, explorar, pular, parar, etc).
 *
 * Principais classes:
 *   - ActionExecutor: recebe decisões (BotAction), executa comandos no bot.
 *
 * Extensão:
 *   - Adicionar novos tipos de ações ou customizar lógica de execução.
 *
 * Uso:
 *   Utilizado por AgentLoop para executar ações validadas pelo schema.
 */
import type { Bot } from 'mineflayer';
import type { BotAction, ActionResult } from '@/types/types';
import { MovementManager } from '@/bot/MovementManager';


export class ActionExecutor {
  private bot: Bot;
  private movement: MovementManager;

  constructor(bot: Bot) {
    this.bot = bot;
    this.movement = new MovementManager(bot);
  }

  async executar(decisao: BotAction): Promise<ActionResult> {
    const start = performance.now();

    try {
      switch (decisao.acao) {
        case 'FALAR':
          if (!decisao.conteudo) throw new Error('Conteúdo obrigatório para FALAR');
          this.bot.chat(decisao.conteudo);
          console.log(`🗣️  Falei: ${decisao.conteudo}`);
          break;

        case 'ANDAR': {
          const dir = decisao.direcao || 'frente';
          this.movement.andarNaDirecao(dir);
          console.log(`🚶 Andando para ${dir}`);
          return {
            success: true,
            action: decisao.acao,
            direction: dir,
            content: decisao.conteudo,
            executionTimeMs: performance.now() - start,
          };
        }

        case 'EXPLORAR':
          this.movement.explorarAleatorio();
          console.log('🗺️  Explorando...');
          break;

        case 'PULAR':
          await this.movement.pular();
          console.log('🦘 Pulei!');
          break;

        case 'PARAR':
          this.movement.pararMovimento();
          console.log('🛑 Parei');
          break;

        case 'OLHAR':
          this.olharAoRedor();
          break;

        case 'SEGUIR':
          if (!decisao.alvo) throw new Error('Alvo obrigatório para SEGUIR');
          this.movement.seguirJogador(decisao.alvo);
          console.log(`🏃 Seguindo ${decisao.alvo}`);
          break;

        case 'FUGIR':
          if (!decisao.alvo) throw new Error('Alvo obrigatório para FUGIR');
          this.movement.fugirDeEntidade(decisao.alvo);
          console.log(`💨 Fugindo de ${decisao.alvo}`);
          break;

        case 'COLETAR':
          await this.coletarBlocoProximo(decisao.alvo);
          break;

        case 'ATACAR':
          await this.atacarEntidade(decisao.alvo);
          break;

        case 'NADA':
          console.log('💤 Observando...');
          break;

        default:
          throw new Error(`Ação desconhecida: ${String(decisao.acao)}`);
      }

      return {
        success: true,
        action: decisao.acao,
        direction: decisao.direcao,
        content: decisao.conteudo,
        executionTimeMs: performance.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Erro na ação ${decisao.acao}: ${msg}`);
      return {
        success: false,
        action: decisao.acao,
        direction: decisao.direcao,
        content: decisao.conteudo,
        errorMessage: msg,
        executionTimeMs: performance.now() - start,
      };
    }
  }

  private olharAoRedor(): void {
    const players = Object.values(this.bot.players).filter(
      (p) => p.username !== this.bot.username && p.entity,
    );

    if (players.length > 0) {
      const target = players[Math.floor(Math.random() * players.length)];
      if (target?.entity) {
        this.bot.lookAt(target.entity.position.offset(0, 1.6, 0));
        console.log(`👀 Olhei para ${target.username}`);
      }
    } else {
      this.bot.look(Math.random() * Math.PI * 2, 0);
      console.log('👀 Olhei ao redor');
    }
  }

  private async coletarBlocoProximo(alvo?: string): Promise<void> {
    const botPos = this.bot.entity.position;

    for (let r = 1; r <= 4; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            try {
              const block = this.bot.blockAt(botPos.offset(dx, dy, dz));
              if (!block || block.name === 'air') continue;
              if (alvo && !block.name.includes(alvo.toLowerCase())) continue;

              await this.bot.dig(block);
              console.log(`⛏️  Coletei ${block.name}`);
              return;
            } catch {
              continue;
            }
          }
        }
      }
    }

    throw new Error(`Nenhum bloco ${alvo || ''} encontrado para coletar`);
  }

  private async atacarEntidade(alvo?: string): Promise<void> {
    const entity = Object.values(this.bot.entities).find((e) => {
      if (e === this.bot.entity) return false;
      if (!alvo) return e.type === 'mob';
      const name = e.username || e.displayName || '';
      return name.toLowerCase().includes(alvo.toLowerCase());
    });

    if (entity) {
      this.bot.attack(entity);
      console.log(`⚔️  Ataquei ${entity.username || entity.displayName || 'entidade'}`);
    } else {
      throw new Error(`Nenhuma entidade ${alvo || ''} encontrada para atacar`);
    }
  }
}

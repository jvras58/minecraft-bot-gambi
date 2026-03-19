/**
 * botAction.ts
 *
 * Define o schema Zod para validação das ações do bot Minecraft.
 * Garante que apenas ações válidas e bem formatadas sejam executadas.
 *
 * Principais objetos/tipos:
 *   - botActionSchema: validação de campos de ação.
 *   - BotAction: tipo inferido do schema.
 *
 * Extensão:
 *   - Adicione novas ações ou campos ao schema conforme expansão do bot.
 *
 * Uso:
 *   Utilizado por AgentLoop, ActionExecutor e tipos globais para garantir integridade das ações.
 */
import { z } from 'zod';

export const botActionSchema = z.object({
  acao: z.enum(['FALAR', 'ANDAR', 'PULAR', 'OLHAR', 'EXPLORAR', 'PARAR', 'NADA', 'SEGUIR', 'FUGIR', 'COLETAR', 'ATACAR']),
  conteudo: z.string().optional(),
  direcao: z.enum(['frente', 'tras', 'esquerda', 'direita', 'aleatorio']).optional(),
  raciocinio: z.string().optional(),
  alvo: z.string().optional(),
});

export type BotAction = z.infer<typeof botActionSchema>;

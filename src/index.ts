/**
 * index.ts
 *
 * Ponto de entrada do bot Minecraft com IA (modo fan-out benchmark).
 * O bot envia o mesmo prompt para TODOS os participantes da sala
 * e loga todas as respostas no Supabase para análise comparativa.
 */
import { botConfig, gambiarraConfig } from '@/config/settings';
import { BotManager } from '@/bot/BotManager';
import { AgentLoop } from '@/core/AgentLoop';
import { GambiLLM } from '@/llm/GambiarraLLM';
import { sleep } from '@/utils/sleep';
import { parseArgs } from '@/utils/args';

function printUsage(): void {
  console.log(`
🤖 Minecraft Bot — Benchmark Fan-out (via Gambi Hub)

O bot envia o MESMO prompt para TODOS os participantes da sala em paralelo.
Cada resposta é logada no Supabase para análise comparativa modelo × hardware.

Uso:
  bun run dev -- --room <ROOM_CODE> [opções]

Opções:
  --room, -r <code>    Código da sala Gambi (obrigatório)
  --hub <url>          URL do hub (default: ${gambiarraConfig.hubUrl})
  --help, -h           Mostra esta ajuda

Exemplo:
  bun run dev -- --room ABC123
  bun run dev -- --room ABC123 --hub http://192.168.1.10:3000

Variáveis de ambiente:
  SUPABASE_URL         URL do projeto Supabase (para coleta de dados)
  SUPABASE_ANON_KEY    Chave anônima do Supabase
  MINECRAFT_HOST       Host do servidor Minecraft (default: localhost)
  MINECRAFT_PORT       Porta do servidor (default: 25565)
  BOT_USERNAME         Nome do bot (default: AgenteBot)
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.room) {
    console.error('❌ Room code obrigatório!\n');
    console.error('   Crie uma sala com: gambi create --name "Benchmark AI"');
    console.error('   Depois execute:    bun run dev --room <ROOM_CODE>\n');
    printUsage();
    process.exit(1);
  }

  const roomCode = args.room;
  const hubUrl = args.hub ?? gambiarraConfig.hubUrl;

  console.log('🤖 Minecraft Bot — Benchmark Fan-out\n');
  console.log(`   Sala: ${roomCode}`);
  console.log(`   Hub:  ${hubUrl}`);
  console.log(`   Modo: fan-out (todos os participantes)\n`);

  // Inicializa o cliente LLM
  const llm = new GambiLLM({ roomCode, hubUrl });

  // Verifica hub
  console.log('🔍 Verificando conexão com Gambi Hub...');
  const health = await llm.healthCheck();
  if (!health.ok) {
    console.error('⚠️  Hub não acessível ou sala sem participantes!');
    console.error('   Continuando mesmo assim (participantes podem entrar depois)...\n');
  } else {
    console.log(`✅ Hub OK — ${health.participants} participante(s) na sala\n`);
  }

  // Inicializa o bot Minecraft
  const botManager = new BotManager(botConfig);
  const agent = new AgentLoop(botManager, llm, {
    roomCode,
    botUsername: botConfig.username,
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Encerrando...');
    await agent.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => { shutdown(); });
  process.on('SIGTERM', () => { shutdown(); });

  // Conecta e inicia
  botManager.createBot();
  await sleep(2000);
  await agent.start();
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
/**
 * index.ts
 *
 * Ponto de entrada do bot Minecraft com IA.
 * Processa argumentos CLI, inicializa configurações e instancia bot, loop e LLM.
 *
 * Principais funções:
 *   - main: processa argumentos, valida sala, inicializa configs.
 *   - printUsage: exibe instruções de uso.
 *
 * Extensão:
 *   - Personalização via argumentos CLI e variáveis de ambiente.
 *
 * Uso:
 *   Executado diretamente para iniciar o bot.
 */
import { botConfig, gambiarraConfig } from './config/settings';
import { BotManager } from './bot/BotManager';
import { AgentLoop } from './core/AgentLoop';
import { GambiLLM } from './llm/GambiarraLLM';
import { sleep } from './utils/sleep';
import { parseArgs } from './utils/args';

function printUsage(): void {
  console.log(`
🤖 Minecraft Bot com IA (via Gambiarra Hub)

Uso:
  bun run dev -- --room <ROOM_CODE> [opções]

Opções:
  --room, -r <code>    Código da sala Gambiarra (obrigatório)
  --hub <url>          URL do hub (default: ${gambiarraConfig.hubUrl})
  --model <model>      Roteamento do modelo (default: ${gambiarraConfig.model})
  --help, -h           Mostra esta ajuda

Roteamento de modelo (--model):
  *                    Qualquer participante online (default)
  llama3               Primeiro participante com esse modelo
  participant:joao     Participante específico pelo ID/nickname

Exemplos:
  bun run dev -- --room ABC123
  bun run dev -- --room ABC123 --hub http://192.168.1.10:3000
  bun run dev -- --room ABC123 --model llama3
  bun run dev -- --room ABC123 --model participant:joao-4090
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // --help
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // --room é obrigatório
  if (!args.room) {
    console.error('❌ Room code obrigatório!\n');
    console.error('   Crie uma sala com: gambiarra create --name "Minecraft AI"');
    console.error('   Depois execute:    bun run dev --room <ROOM_CODE>\n');
    printUsage();
    process.exit(1);
  }

  const roomCode = args.room;
  const hubUrl = args.hub ?? gambiarraConfig.hubUrl;
  const model = args.model ?? gambiarraConfig.model;

  console.log('🤖 Minecraft Bot com IA (via Gambiarra Hub)\n');
  console.log(`   Sala:   ${roomCode}`);
  console.log(`   Hub:    ${hubUrl}`);
  console.log(`   Modelo: ${model === '*' ? 'qualquer participante' : model}`);

  // Inicializa o cliente LLM com os args
  const llm = new GambiLLM({ roomCode, hubUrl, model });

  // Verifica se o hub está acessível
  console.log('\n🔍 Verificando conexão com Gambiarra Hub...');
  const health = await llm.healthCheck();
  if (!health.ok) {
    console.error('⚠️  Hub não acessível ou sala sem participantes!');
    console.error('   Continuando mesmo assim (o hub pode subir depois)...\n');
  } else {
    console.log(`✅ Hub OK — ${health.participants} participante(s) na sala\n`);
  }

  // Inicializa o bot Minecraft
  const botManager = new BotManager(botConfig);
  const agent = new AgentLoop(botManager, llm);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Encerrando...');
    agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Conecta e inicia
  botManager.createBot();
  await sleep(2000);
  agent.start();
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});

import { botConfig } from '@/config/settings';
import { BotManager } from '@/bot/BotManager';

console.log('Config:', JSON.stringify(botConfig));
const botManager = new BotManager(botConfig);
botManager.createBot();

setTimeout(() => {
  console.log('⏰ TIMEOUT — never spawned');
  process.exit(1);
}, 15000);

import { AuthMemoryStore } from './bot/memory.js';
import { BOT_COMMANDS, createBot } from './bot/createBot.js';
import { loadConfig } from './config.js';
import { PhotoCollector } from './images/collector.js';
import { MediaGroupQueue } from './images/mediaGroup.js';
import { createLogger } from './logger.js';
import { Rotator } from './rotator/rotator.js';
import { UserStore } from './storage/store.js';
import { ClientManager } from './telegram/manager.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const store = new UserStore(config.dataDir);
const clients = new ClientManager(config, store, logger);
const rotator = new Rotator(store, clients, logger);
const app = {
  config,
  store,
  clients,
  rotator,
  logger,
  auth: new AuthMemoryStore(),
  collector: new PhotoCollector(),
  albums: new MediaGroupQueue<string>(),
};

const bot = createBot(app);

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutting down', { signal });
  rotator.stopAll();
  await clients.disconnectAll();
  await bot.stop();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

await store.init();
await clients.restoreAll();

for (const user of store.listUsers()) {
  app.auth.setPhase(user.userId, (await store.hasSession(user.userId)) ? 'ready' : 'idle');
}

rotator.startAll();
logger.info('Starting Telegram bot');
await bot.start({
  onStart: (info) => {
    void bot.api.setMyCommands([...BOT_COMMANDS]);
    logger.info('Bot is running', { username: info.username });
  },
});

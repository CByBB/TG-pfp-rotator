import { Bot } from 'grammy';
import type { App } from './app.js';
import {
  handleCodeCallback,
  handleContact,
  handleDonate,
  handleHelp,
  handleImage,
  handleInterval,
  handleIntervalCallback,
  handlePause,
  handleResume,
  handleStart,
  handleStatus,
  handleTextFallback,
} from './handlers.js';

export const BOT_COMMANDS = [
  { command: 'start', description: 'Welcome and request phone access' },
  { command: 'help', description: 'Show the full usage guide' },
  { command: 'interval', description: 'Choose rotation speed' },
  { command: 'pause', description: 'Pause profile photo rotation' },
  { command: 'resume', description: 'Resume profile photo rotation' },
  { command: 'status', description: 'Show gallery and rotation state' },
  { command: 'donate', description: 'Donation and public repo links' },
] as const;

export function createBot(app: App): Bot {
  const bot = new Bot(app.config.botToken);

  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') {
      return;
    }
    await next();
  });

  bot.command('start', (ctx) => handleStart(app, ctx));
  bot.command('help', (ctx) => handleHelp(app, ctx));
  bot.command('donate', (ctx) => handleDonate(app, ctx));
  bot.command('status', (ctx) => handleStatus(app, ctx));
  bot.command('interval', (ctx) => handleInterval(app, ctx));
  bot.command('pause', (ctx) => handlePause(app, ctx));
  bot.command('resume', (ctx) => handleResume(app, ctx));

  bot.on('message:contact', (ctx) => handleContact(app, ctx));
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith('code:')) {
      await handleCodeCallback(app, ctx);
      return;
    }
    if (data.startsWith('interval:')) {
      await handleIntervalCallback(app, ctx);
    }
  });

  bot.on(['message:photo', 'message:document'], (ctx) => handleImage(app, ctx));
  bot.on('message:text', (ctx) => handleTextFallback(app, ctx));

  bot.catch((error) => {
    app.logger.error('Bot update failed', {
      error: error.message,
      stack: error.stack,
    });
  });

  return bot;
}

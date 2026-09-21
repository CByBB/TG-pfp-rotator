import type { Context } from 'grammy';
import { isGifFile, isSupportedImage, isVideoFile, replaceGallery } from '../images/process.js';
import { donateMessage, helpMessage, welcomeMessage } from '../texts.js';
import { INTERVAL_OPTIONS, LOGIN_CODE_LENGTH, MAX_GALLERY_IMAGES } from '../types.js';
import { formatInterval, normalizePhone } from '../utils.js';
import type { App } from './app.js';
import { downloadFileById } from './download.js';
import {
  codeKeyboard,
  codePrompt,
  intervalKeyboard,
  phoneKeyboard,
  removeKeyboard,
} from './keyboards.js';

function userIdOf(ctx: Context): number {
  const id = ctx.from?.id;
  if (!id) {
    throw new Error('Missing user id');
  }
  return id;
}

async function ensureUser(app: App, ctx: Context) {
  return app.store.getOrCreate(userIdOf(ctx), {
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
  });
}

export async function handleStart(app: App, ctx: Context): Promise<void> {
  const userId = userIdOf(ctx);
  await ensureUser(app, ctx);
  const loggedIn = await app.store.hasSession(userId);

  if (loggedIn) {
    app.auth.setPhase(userId, 'ready');
    await ctx.reply(welcomeMessage(app.config), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: removeKeyboard(),
    });
    await ctx.reply(
      'You are already signed in. Send photos, GIFs, or videos to update your set, or use the commands above.',
    );
    return;
  }

  app.auth.set(userId, {
    phase: 'awaiting_phone',
    codeBuffer: '',
    codeMessageId: undefined,
    codeViaApp: true,
  });
  await ctx.reply(welcomeMessage(app.config), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: phoneKeyboard(),
  });
}

export async function handleHelp(app: App, ctx: Context): Promise<void> {
  await ctx.reply(helpMessage(app.config), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

export async function handleDonate(app: App, ctx: Context): Promise<void> {
  await ctx.reply(donateMessage(app.config), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

export async function handleStatus(app: App, ctx: Context): Promise<void> {
  const user = await ensureUser(app, ctx);
  const loggedIn = await app.store.hasSession(user.userId);
  const running = app.rotator.isRunning(user.userId);
  const lines = [
    `Logged in: ${loggedIn ? 'yes' : 'no'}`,
    `Gallery: ${user.imageFiles.length} image(s)`,
    `Interval: ${formatInterval(user.intervalMs)}`,
    `Rotation: ${user.paused ? 'paused' : running ? 'running' : 'idle'}`,
  ];
  if (user.lastRotatedAt) {
    lines.push(`Last change: ${user.lastRotatedAt}`);
  }
  await ctx.reply(lines.join('\n'));
}

export async function handleInterval(app: App, ctx: Context): Promise<void> {
  const user = await ensureUser(app, ctx);
  if (!(await app.store.hasSession(user.userId))) {
    await ctx.reply('Log in first with /start and share your phone number.');
    return;
  }
  await ctx.reply(
    `Current interval: ${formatInterval(user.intervalMs)}\nChoose how often the profile photo should change:`,
    { reply_markup: intervalKeyboard() },
  );
}

export async function handlePause(app: App, ctx: Context): Promise<void> {
  const user = await ensureUser(app, ctx);
  if (!(await app.store.hasSession(user.userId))) {
    await ctx.reply('Log in first with /start.');
    return;
  }
  await app.store.update(user.userId, { paused: true });
  app.rotator.stop(user.userId);
  await ctx.reply('Rotation paused. Send /resume when you want it to continue.');
}

export async function handleResume(app: App, ctx: Context): Promise<void> {
  const user = await ensureUser(app, ctx);
  if (!(await app.store.hasSession(user.userId))) {
    await ctx.reply('Log in first with /start.');
    return;
  }
  if (user.imageFiles.length === 0) {
    await app.store.update(user.userId, { paused: false });
    await ctx.reply('Nothing to resume yet. Send some photos first.');
    return;
  }
  await app.store.update(user.userId, { paused: false });
  app.rotator.start(user.userId);
  await ctx.reply(
    user.imageFiles.length < 2
      ? 'You only have one photo, so there is nothing to rotate.'
      : `Rotation resumed. Photos will change every ${formatInterval(user.intervalMs)}.`,
  );
}

export async function handleContact(app: App, ctx: Context): Promise<void> {
  const userId = userIdOf(ctx);
  const contact = ctx.message?.contact;
  if (!contact) {
    return;
  }
  if (contact.user_id && contact.user_id !== userId) {
    await ctx.reply('Please share *your own* phone number with the button.', {
      parse_mode: 'Markdown',
      reply_markup: phoneKeyboard(),
    });
    return;
  }

  await ensureUser(app, ctx);
  const phone = normalizePhone(contact.phone_number);

  try {
    const { viaApp } = await app.clients.beginLogin(userId, phone);
    app.auth.set(userId, { phase: 'awaiting_code', codeBuffer: '', codeViaApp: viaApp });
    const message = await ctx.reply(codePrompt('', viaApp), {
      parse_mode: 'Markdown',
      reply_markup: codeKeyboard(),
    });
    app.auth.set(userId, { codeMessageId: message.message_id });
    await ctx.reply('Phone received. Enter the login code with the buttons above.', {
      reply_markup: removeKeyboard(),
    });
  } catch (error) {
    app.logger.error('Failed to send login code', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    await ctx.reply(
      'Could not start login for that number. Check the API credentials and try /start again.',
      { reply_markup: phoneKeyboard() },
    );
  }
}

export async function handleCodeCallback(app: App, ctx: Context): Promise<void> {
  const userId = userIdOf(ctx);
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('code:')) {
    return;
  }

  const state = app.auth.get(userId);
  if (state.phase !== 'awaiting_code') {
    await ctx.answerCallbackQuery({ text: 'No login code is expected right now.' });
    return;
  }

  const action = data.slice('code:'.length);
  let buffer = state.codeBuffer;

  if (action === 'back') {
    buffer = buffer.slice(0, -1);
  } else if (action === 'ok') {
    if (buffer.length < LOGIN_CODE_LENGTH) {
      await ctx.answerCallbackQuery({ text: `Enter all ${LOGIN_CODE_LENGTH} digits first.` });
      return;
    }
    await ctx.answerCallbackQuery({ text: 'Checking code…' });
    await submitLoginCode(app, ctx, buffer);
    return;
  } else if (/^\d$/.test(action)) {
    if (buffer.length >= LOGIN_CODE_LENGTH) {
      await ctx.answerCallbackQuery({ text: 'Code is already complete. Tap ✓' });
      return;
    }
    buffer += action;
  } else {
    await ctx.answerCallbackQuery();
    return;
  }

  app.auth.set(userId, { codeBuffer: buffer });
  try {
    await ctx.editMessageText(codePrompt(buffer, state.codeViaApp), {
      parse_mode: 'Markdown',
      reply_markup: codeKeyboard(),
    });
  } catch {
    // ignore "message is not modified"
  }

  if (buffer.length === LOGIN_CODE_LENGTH) {
    await ctx.answerCallbackQuery({ text: 'Checking code…' });
    await submitLoginCode(app, ctx, buffer);
    return;
  }

  await ctx.answerCallbackQuery();
}

async function submitLoginCode(app: App, ctx: Context, code: string): Promise<void> {
  const userId = userIdOf(ctx);
  const result = await app.clients.submitCode(userId, code);

  if ('needsPassword' in result) {
    app.auth.set(userId, { phase: 'awaiting_2fa', codeBuffer: '' });
    await ctx.reply(
      'This account has two-step verification. Send your 2FA cloud password as a message. I will not show it back to you.',
    );
    return;
  }

  if ('error' in result) {
    app.auth.set(userId, { codeBuffer: '' });
    try {
      await ctx.editMessageText(codePrompt('', app.auth.get(userId).codeViaApp), {
        parse_mode: 'Markdown',
        reply_markup: codeKeyboard(),
      });
    } catch {
      // ignore
    }
    await ctx.reply(result.error);
    return;
  }

  await finishLogin(app, ctx);
}

export async function handlePassword(app: App, ctx: Context): Promise<boolean> {
  const userId = userIdOf(ctx);
  if (app.auth.get(userId).phase !== 'awaiting_2fa') {
    return false;
  }

  const password = ctx.message?.text?.trim();
  if (!password) {
    await ctx.reply('Send your 2FA password as plain text.');
    return true;
  }

  const result = await app.clients.submitPassword(userId, password);
  if ('error' in result) {
    await ctx.reply(result.error);
    return true;
  }

  await finishLogin(app, ctx);
  return true;
}

async function finishLogin(app: App, ctx: Context): Promise<void> {
  const userId = userIdOf(ctx);
  app.auth.set(userId, { phase: 'ready', codeBuffer: '', codeMessageId: undefined });
  await ctx.reply(
    [
      'Login successful.',
      '',
      'Now send photos, GIFs, or videos to use as profile photos.',
      'Stills are cropped to a square. GIFs and short videos become an animated profile photo.',
      'Sending a new batch later *replaces* the previous gallery.',
    ].join('\n'),
    { parse_mode: 'Markdown' },
  );
}

export async function handleIntervalCallback(app: App, ctx: Context): Promise<void> {
  const userId = userIdOf(ctx);
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('interval:')) {
    return;
  }

  const ms = Number(data.slice('interval:'.length));
  const option = INTERVAL_OPTIONS.find((item) => item.ms === ms);
  if (!option) {
    await ctx.answerCallbackQuery({ text: 'Unknown interval.' });
    return;
  }

  const user = await app.store.update(userId, { intervalMs: option.ms });
  if (!user.paused && user.imageFiles.length > 0) {
    app.rotator.restart(userId);
  }

  await ctx.answerCallbackQuery({ text: `Interval set to ${option.label}` });
  await ctx.editMessageText(`Rotation interval is now *${option.label}*.`, {
    parse_mode: 'Markdown',
  });
}

export async function handleImage(app: App, ctx: Context): Promise<void> {
  const userId = userIdOf(ctx);
  await ensureUser(app, ctx);

  if (!(await app.store.hasSession(userId))) {
    await ctx.reply('Log in first with /start and share your phone number.');
    return;
  }

  const photo = ctx.message?.photo?.at(-1);
  const animation = ctx.message?.animation;
  const video = ctx.message?.video;
  const document = ctx.message?.document;
  const mime = animation?.mime_type ?? video?.mime_type ?? document?.mime_type;
  const fileName = animation?.file_name ?? video?.file_name ?? document?.file_name;
  const fileId = photo?.file_id ?? animation?.file_id ?? video?.file_id ?? document?.file_id;

  if (
    !fileId ||
    (!photo &&
      !animation &&
      !video &&
      !isSupportedImage(mime, fileName) &&
      !isGifFile(mime, fileName) &&
      !isVideoFile(mime, fileName))
  ) {
    await ctx.reply('Please send a photo, GIF, video, or image file.');
    return;
  }

  const mediaGroupId = ctx.message?.media_group_id;
  app.albums.enqueue(userId, mediaGroupId, fileId, (fileIds) => {
    void ingestPhotoGroup(app, ctx, fileIds);
  });
}

async function ingestPhotoGroup(app: App, ctx: Context, fileIds: string[]): Promise<void> {
  const userId = userIdOf(ctx);
  const replacing = (app.store.get(userId)?.imageFiles.length ?? 0) > 0;
  const buffers: Buffer[] = [];

  for (const fileId of fileIds) {
    try {
      buffers.push(await downloadFileById(ctx.api, app.config.botToken, fileId));
    } catch (error) {
      app.logger.error('Failed to download image', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (buffers.length === 0) {
    await ctx.reply('Could not download those images. Try sending them again.');
    return;
  }

  for (const buffer of buffers) {
    app.collector.add(userId, buffer, (batch, progressMessageId) => {
      void flushGallery(app, ctx, batch, progressMessageId);
    });
  }

  await app.collector.updateProgress(userId, async (count, messageId) => {
    const text = collectingText(count, replacing);
    const chatId = ctx.chat?.id;
    if (!messageId) {
      const sent = await ctx.reply(text);
      return sent.message_id;
    }
    if (chatId) {
      try {
        await ctx.api.editMessageText(chatId, messageId, text);
      } catch {
        // ignore "message is not modified"
      }
    }
    return messageId;
  });
}

function collectingText(count: number, replacing: boolean): string {
  const photos = count === 1 ? '1 photo' : `${count} photos`;
  const replaceNote = replacing ? ' These will replace your current set.' : '';
  return `Received ${photos}.${replaceNote}\nSend more, or wait a moment to save.`;
}

async function flushGallery(
  app: App,
  ctx: Context,
  buffers: Buffer[],
  progressMessageId?: number,
): Promise<void> {
  const userId = userIdOf(ctx);
  const limited = buffers.slice(0, MAX_GALLERY_IMAGES);

  try {
    const files = await replaceGallery(app.store.imagesDir(userId), limited);
    const user = await app.store.replaceImages(userId, files);
    if (!user.paused) {
      app.rotator.applyAndStart(userId);
    }
    const extra =
      buffers.length > files.length
        ? `\nKept ${files.length} of ${buffers.length} (limit is ${MAX_GALLERY_IMAGES}, unreadable files are skipped).`
        : '';
    const text = [
      `Saved ${files.length} ${files.length === 1 ? 'photo' : 'photos'}.${extra}`,
      user.paused
        ? 'Rotation is paused. Send /resume to start.'
        : files.length < 2
          ? 'Only one photo is saved, so it will stay as your profile photo.'
          : `Rotation is running every ${formatInterval(user.intervalMs)}.`,
    ].join('\n');

    if (progressMessageId && ctx.chat) {
      try {
        await ctx.api.editMessageText(ctx.chat.id, progressMessageId, text);
        return;
      } catch {
        // fall through to a new message
      }
    }
    await ctx.reply(text);
  } catch (error) {
    app.logger.error('Failed to save gallery', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    await ctx.reply('Could not process those images. Please send them again.');
  }
}

export async function handleTextFallback(app: App, ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  if (text.startsWith('/')) {
    return;
  }

  if (await handlePassword(app, ctx)) {
    return;
  }

  const userId = userIdOf(ctx);
  const phase = app.auth.get(userId).phase;
  if (phase === 'awaiting_phone') {
    await ctx.reply('Use the button to share your phone number.', {
      reply_markup: phoneKeyboard(),
    });
    return;
  }
  if (phase === 'awaiting_code') {
    await ctx.reply('Use the number pad in the previous message. Do not type the code as text.');
    return;
  }

  const loggedIn = await app.store.hasSession(userId);
  if (!loggedIn) {
    await ctx.reply('Send /start to begin and share your phone number.');
    return;
  }

  await ctx.reply(
    'Send photos, GIFs, or videos to replace your gallery, or use /help, /interval, /pause, /resume, /status.',
  );
}

import type { Context } from 'grammy';
import {
  BASE_GALLERY_LIMIT,
  PREMIUM_GALLERY_LIMIT,
  PREMIUM_PAYLOAD,
  PREMIUM_STARS,
  galleryLimit,
  isPremium,
} from '../types.js';
import type { App } from './app.js';
import { upgradeKeyboard } from './keyboards.js';

function userIdOf(ctx: Context): number {
  const id = ctx.from?.id;
  if (!id) {
    throw new Error('Missing user id');
  }
  return id;
}

function formatPremiumUntil(iso?: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

export async function handleUpgrade(app: App, ctx: Context): Promise<void> {
  const user = await app.store.getOrCreate(userIdOf(ctx), {
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
  });
  const premium = isPremium(user);
  const until = formatPremiumUntil(user.premiumUntil);
  const lines = [
    `Free: ${BASE_GALLERY_LIMIT} images.`,
    `Premium: up to ${PREMIUM_GALLERY_LIMIT} images for 30 days.`,
    `${PREMIUM_STARS} Stars per month. It is not permanent.`,
    premium
      ? `Your plan: Premium until ${until}.`
      : `Your plan: Free (${galleryLimit(user)} images).`,
  ];
  await ctx.reply(lines.join('\n'), { reply_markup: upgradeKeyboard() });
}

export async function handleBuyCallback(_app: App, ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (data !== 'buy:premium') {
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.replyWithInvoice(
    'Premium membership',
    `Up to ${PREMIUM_GALLERY_LIMIT} profile photos for 30 days.`,
    PREMIUM_PAYLOAD,
    'XTR',
    [{ label: 'Premium · 30 days', amount: PREMIUM_STARS }],
  );
}

export async function handlePreCheckout(ctx: Context): Promise<void> {
  const payload = ctx.preCheckoutQuery?.invoice_payload ?? '';
  if (payload !== PREMIUM_PAYLOAD) {
    await ctx.answerPreCheckoutQuery(false, 'This offer is no longer valid.');
    return;
  }
  await ctx.answerPreCheckoutQuery(true);
}

export async function handleSuccessfulPayment(app: App, ctx: Context): Promise<void> {
  const payment = ctx.message?.successful_payment;
  if (!payment) {
    return;
  }

  if (payment.invoice_payload !== PREMIUM_PAYLOAD) {
    await ctx.reply('Payment received, but the offer could not be applied. Contact support.');
    return;
  }

  const user = await app.store.activatePremium(userIdOf(ctx), payment.telegram_payment_charge_id);
  const until = formatPremiumUntil(user.premiumUntil);
  await ctx.reply(
    `Premium is active until ${until}. You can now use up to ${PREMIUM_GALLERY_LIMIT} images.`,
  );
}

import { InlineKeyboard, Keyboard } from 'grammy';
import { INTERVAL_OPTIONS, LOGIN_CODE_LENGTH } from '../types.js';
import { maskCode } from '../utils.js';

export function phoneKeyboard(): Keyboard {
  return new Keyboard().requestContact('Share phone number').resized().oneTime();
}

export function removeKeyboard(): { remove_keyboard: true } {
  return { remove_keyboard: true };
}

export function codeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('1', 'code:1')
    .text('2', 'code:2')
    .text('3', 'code:3')
    .row()
    .text('4', 'code:4')
    .text('5', 'code:5')
    .text('6', 'code:6')
    .row()
    .text('7', 'code:7')
    .text('8', 'code:8')
    .text('9', 'code:9')
    .row()
    .text('⌫', 'code:back')
    .text('0', 'code:0')
    .text('✓', 'code:ok');
}

export function upgradeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('Premium · 100 Stars / month', 'buy:premium');
}

export function intervalKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  INTERVAL_OPTIONS.forEach((option, index) => {
    keyboard.text(option.label, `interval:${option.ms}`);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });
  if (INTERVAL_OPTIONS.length % 2 === 1) {
    keyboard.row();
  }
  return keyboard;
}

export function codePrompt(buffer: string, viaApp: boolean): string {
  const destination = viaApp
    ? 'Telegram just sent a login code to the app on that account.'
    : 'Telegram just sent a login code by SMS.';
  return [
    destination,
    'Tap the number buttons below, one digit at a time.',
    '',
    `Code: \`${maskCode(buffer, LOGIN_CODE_LENGTH)}\``,
  ].join('\n');
}

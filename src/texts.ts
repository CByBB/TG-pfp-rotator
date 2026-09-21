import type { Config } from './config.js';

function link(url: string, label: string): string {
  return `<a href="${url}">${label}</a>`;
}

export function welcomeMessage(config: Config): string {
  return [
    '<b>Profile Photo Rotator</b>',
    '',
    'Automatically cycle your Telegram profile photo through photos, GIFs, and videos you send.',
    '',
    '<b>Getting started</b>',
    '1. Share your phone number',
    '2. Enter the login code with the buttons',
    '3. Send your 2FA password if asked',
    '4. Send the photos, GIFs, or videos you want to rotate',
    '',
    'GIFs and short videos become an animated profile photo. Sending a new batch later replaces the current set.',
    'Free accounts can save 5 items. Premium (100 Stars / month) allows up to 30. Use /upgrade.',
    'Use /interval to choose how often the photo changes.',
    '',
    '<b>Commands</b>',
    '/interval — change the rotation speed',
    '/pause — pause rotation',
    '/resume — resume rotation',
    '/upgrade — monthly Premium with Stars',
    '/status — see current status',
    '/donate — support the project',
    '',
    '⚠️ <b>Caution</b>',
    'We are not responsible for any account data leak, loss, ban, or other problem caused by using this bot. You use it at your own risk. To check that it is safe, review the source code on GitHub.',
    '',
    `${link(config.repoUrl, 'GitHub')}  ·  ${link(config.donationUrl, 'Donate')}`,
  ].join('\n');
}

export function helpMessage(config: Config): string {
  return welcomeMessage(config);
}

export function donateMessage(config: Config): string {
  return [
    'Thanks for supporting this project.',
    '',
    link(config.donationUrl, 'Donate'),
    link(config.repoUrl, 'GitHub'),
  ].join('\n');
}

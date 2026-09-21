import type { Config } from './config.js';

function link(url: string, label: string): string {
  return `<a href="${url}">${label}</a>`;
}

export function welcomeMessage(config: Config): string {
  return [
    '<b>Profile Photo Rotator</b>',
    '',
    'Automatically cycle your Telegram profile photo through pictures you send.',
    '',
    '<b>Getting started</b>',
    '1. Share your phone number',
    '2. Enter the login code with the buttons',
    '3. Send your 2FA password if asked',
    '4. Send the photos you want to rotate',
    '',
    'Sending new photos later replaces the current set.',
    'Use /interval to choose how often the photo changes.',
    '',
    '<b>Commands</b>',
    '/interval — change the rotation speed',
    '/pause — pause rotation',
    '/resume — resume rotation',
    '/status — see current status',
    '/donate — support the project',
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

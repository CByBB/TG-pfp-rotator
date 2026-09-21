import type { Api } from 'grammy';
import type { File } from 'grammy/types';

export async function downloadBotFile(botToken: string, file: File): Promise<Buffer> {
  if (!file.file_path) {
    throw new Error('Telegram did not return a file path');
  }
  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function downloadFileById(
  api: Api,
  botToken: string,
  fileId: string,
): Promise<Buffer> {
  const file = await api.getFile(fileId);
  return downloadBotFile(botToken, file);
}

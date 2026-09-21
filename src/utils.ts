import { INTERVAL_OPTIONS } from './types.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return `+${digits}`;
}

export function formatInterval(ms: number): string {
  const known = INTERVAL_OPTIONS.find((option) => option.ms === ms);
  if (known) {
    return known.label;
  }
  if (ms % 86_400_000 === 0) {
    const days = ms / 86_400_000;
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (ms % 3_600_000 === 0) {
    const hours = ms / 3_600_000;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  const seconds = Math.round(ms / 1000);
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

export function maskCode(buffer: string, length: number): string {
  const cells = Array.from({ length }, (_, index) => buffer[index] ?? '_');
  return cells.join(' ');
}

export function getRpcMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'errorMessage' in error) {
    const message = (error as { errorMessage?: unknown }).errorMessage;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

export function getFloodWaitSeconds(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'seconds' in error) {
    const seconds = (error as { seconds?: unknown }).seconds;
    return typeof seconds === 'number' ? seconds : undefined;
  }
  const message = getRpcMessage(error) ?? (error instanceof Error ? error.message : '');
  const match = /FLOOD_WAIT_(\d+)/.exec(message);
  return match ? Number(match[1]) : undefined;
}

export type UserPhase = 'idle' | 'awaiting_phone' | 'awaiting_code' | 'awaiting_2fa' | 'ready';

export interface UserRecord {
  userId: number;
  username?: string;
  firstName?: string;
  phone?: string;
  phoneCodeHash?: string;
  intervalMs: number;
  paused: boolean;
  currentIndex: number;
  imageFiles: string[];
  lastRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthMemory {
  phase: UserPhase;
  codeBuffer: string;
  codeMessageId?: number;
  codeViaApp: boolean;
}

export const INTERVAL_OPTIONS = [
  { label: '30 seconds', ms: 30_000 },
  { label: '1 minute', ms: 60_000 },
  { label: '5 minutes', ms: 5 * 60_000 },
  { label: '15 minutes', ms: 15 * 60_000 },
  { label: '30 minutes', ms: 30 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: '6 hours', ms: 6 * 60 * 60_000 },
  { label: '12 hours', ms: 12 * 60 * 60_000 },
  { label: '1 day', ms: 24 * 60 * 60_000 },
] as const;

export const DEFAULT_INTERVAL_MS = 5 * 60_000;
export const LOGIN_CODE_LENGTH = 5;
export const PROFILE_PHOTO_SIZE = 640;
export const PHOTO_BATCH_SETTLE_MS = 4_000;
export const MEDIA_GROUP_SETTLE_MS = 1_200;
export const MAX_GALLERY_IMAGES = 50;

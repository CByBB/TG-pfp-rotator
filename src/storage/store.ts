import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_INTERVAL_MS, PREMIUM_DURATION_MS, type UserRecord } from '../types.js';
import { nowIso } from '../utils.js';
import {
  ensureDir,
  listDirectories,
  removePath,
  writeJsonAtomic,
  writeTextAtomic,
} from './files.js';

export class UserStore {
  private readonly cache = new Map<number, UserRecord>();

  constructor(private readonly dataDir: string) {}

  usersRoot(): string {
    return path.join(this.dataDir, 'users');
  }

  userDir(userId: number): string {
    return path.join(this.usersRoot(), String(userId));
  }

  imagesDir(userId: number): string {
    return path.join(this.userDir(userId), 'images');
  }

  private userFile(userId: number): string {
    return path.join(this.userDir(userId), 'user.json');
  }

  private sessionFile(userId: number): string {
    return path.join(this.userDir(userId), 'session.txt');
  }

  async init(): Promise<void> {
    await ensureDir(this.usersRoot());
    const ids = await listDirectories(this.usersRoot());
    await Promise.all(ids.map((id) => this.loadUser(Number(id))));
  }

  listUsers(): UserRecord[] {
    return [...this.cache.values()];
  }

  get(userId: number): UserRecord | undefined {
    return this.cache.get(userId);
  }

  async getOrCreate(
    userId: number,
    extras: Pick<UserRecord, 'username' | 'firstName'> = {},
  ): Promise<UserRecord> {
    const existing = this.cache.get(userId);
    if (existing) {
      return existing;
    }

    const now = nowIso();
    const record: UserRecord = {
      userId,
      username: extras.username,
      firstName: extras.firstName,
      intervalMs: DEFAULT_INTERVAL_MS,
      paused: false,
      currentIndex: 0,
      imageFiles: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.save(record);
    return record;
  }

  async save(record: UserRecord): Promise<void> {
    const next = { ...record, updatedAt: nowIso() };
    this.cache.set(record.userId, next);
    await writeJsonAtomic(this.userFile(record.userId), next);
  }

  async update(userId: number, patch: Partial<UserRecord>): Promise<UserRecord> {
    const current = await this.getOrCreate(userId);
    const next = { ...current, ...patch, userId };
    await this.save(next);
    return next;
  }

  async readSession(userId: number): Promise<string | undefined> {
    try {
      const contents = await readFile(this.sessionFile(userId), 'utf8');
      const session = contents.trim();
      return session || undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async writeSession(userId: number, session: string): Promise<void> {
    await writeTextAtomic(this.sessionFile(userId), `${session}\n`);
  }

  async clearSession(userId: number): Promise<void> {
    await removePath(this.sessionFile(userId));
  }

  async activatePremium(
    userId: number,
    chargeId: string,
    expirationUnix?: number,
  ): Promise<UserRecord> {
    const current = await this.getOrCreate(userId);
    if (current.lastPaymentChargeId === chargeId) {
      return current;
    }
    const now = Date.now();
    const currentEnd = current.premiumUntil ? Date.parse(current.premiumUntil) : 0;
    const base = Number.isFinite(currentEnd) && currentEnd > now ? currentEnd : now;
    const until = expirationUnix ? expirationUnix * 1000 : base + PREMIUM_DURATION_MS;
    return this.update(userId, {
      premiumUntil: new Date(until).toISOString(),
      lastPaymentChargeId: chargeId,
    });
  }

  async replaceImages(userId: number, files: string[]): Promise<UserRecord> {
    return this.update(userId, {
      imageFiles: files,
      currentIndex: 0,
    });
  }

  async clearImages(userId: number): Promise<void> {
    await removePath(this.imagesDir(userId));
    await ensureDir(this.imagesDir(userId));
    await this.replaceImages(userId, []);
  }

  async hasSession(userId: number): Promise<boolean> {
    return Boolean(await this.readSession(userId));
  }

  private async loadUser(userId: number): Promise<void> {
    if (!Number.isInteger(userId)) {
      return;
    }
    try {
      const raw = await readFile(this.userFile(userId), 'utf8');
      const parsed = JSON.parse(raw) as UserRecord;
      this.cache.set(userId, {
        ...parsed,
        userId,
        intervalMs: parsed.intervalMs || DEFAULT_INTERVAL_MS,
        paused: Boolean(parsed.paused),
        currentIndex: parsed.currentIndex || 0,
        imageFiles: parsed.imageFiles ?? [],
        premiumUntil: parsed.premiumUntil,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

import path from 'node:path';
import type { Logger } from '../logger.js';
import type { UserStore } from '../storage/store.js';
import type { ClientManager } from '../telegram/manager.js';
import { nowIso } from '../utils.js';

export class Rotator {
  private readonly timers = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly store: UserStore,
    private readonly clients: ClientManager,
    private readonly logger: Logger,
  ) {}

  startAll(): void {
    for (const user of this.store.listUsers()) {
      if (!user.paused && user.imageFiles.length > 1) {
        this.start(user.userId);
      }
    }
  }

  start(userId: number): void {
    this.stop(userId);
    const user = this.store.get(userId);
    if (!user || user.paused || user.imageFiles.length === 0) {
      return;
    }

    if (user.imageFiles.length === 1) {
      return;
    }

    void this.tick(userId);
    const timer = setInterval(() => {
      void this.tick(userId);
    }, user.intervalMs);
    this.timers.set(userId, timer);
  }

  applyAndStart(userId: number): void {
    this.stop(userId);
    const user = this.store.get(userId);
    if (!user || user.paused || user.imageFiles.length === 0) {
      return;
    }

    void this.tick(userId);
    if (user.imageFiles.length < 2) {
      return;
    }

    const timer = setInterval(() => {
      void this.tick(userId);
    }, user.intervalMs);
    this.timers.set(userId, timer);
  }

  stop(userId: number): void {
    const timer = this.timers.get(userId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(userId);
    }
  }

  stopAll(): void {
    for (const userId of this.timers.keys()) {
      this.stop(userId);
    }
  }

  restart(userId: number): void {
    this.start(userId);
  }

  isRunning(userId: number): boolean {
    return this.timers.has(userId);
  }

  private async tick(userId: number): Promise<void> {
    const user = this.store.get(userId);
    if (!user || user.paused || user.imageFiles.length === 0) {
      this.stop(userId);
      return;
    }

    const fileName = user.imageFiles[user.currentIndex % user.imageFiles.length];
    if (!fileName) {
      return;
    }
    const imagePath = path.join(this.store.imagesDir(userId), fileName);

    try {
      await this.clients.setProfilePhoto(userId, imagePath);
      const nextIndex =
        user.imageFiles.length < 2 ? 0 : (user.currentIndex + 1) % user.imageFiles.length;
      await this.store.update(userId, {
        currentIndex: nextIndex,
        lastRotatedAt: nowIso(),
      });
      this.logger.info('Updated profile photo', { userId, fileName });
    } catch (error) {
      this.logger.error('Profile photo update failed', {
        userId,
        error: this.clients.describeSetPhotoError(error),
      });
    }
  }
}

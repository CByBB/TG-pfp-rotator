import path from 'node:path';
import type { Logger } from '../logger.js';
import type { UserStore } from '../storage/store.js';
import type { ClientManager } from '../telegram/manager.js';
import { activeGallery } from '../types.js';
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
      if (!user.paused && activeGallery(user).length > 1) {
        this.start(user.userId);
      }
    }
  }

  start(userId: number): void {
    this.stop(userId);
    const user = this.store.get(userId);
    const files = user ? activeGallery(user) : [];
    if (!user || user.paused || files.length === 0) {
      return;
    }

    if (files.length === 1) {
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
    const files = user ? activeGallery(user) : [];
    if (!user || user.paused || files.length === 0) {
      return;
    }

    void this.tick(userId);
    if (files.length < 2) {
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
    const files = user ? activeGallery(user) : [];
    if (!user || user.paused || files.length === 0) {
      this.stop(userId);
      return;
    }

    const fileName = files[user.currentIndex % files.length];
    if (!fileName) {
      return;
    }
    const imagePath = path.join(this.store.imagesDir(userId), fileName);

    try {
      await this.clients.setProfilePhoto(userId, imagePath);
      const nextIndex = files.length < 2 ? 0 : (user.currentIndex + 1) % files.length;
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

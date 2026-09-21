import { PHOTO_BATCH_SETTLE_MS } from '../types.js';

interface Batch {
  buffers: Buffer[];
  timer?: NodeJS.Timeout;
  progressMessageId?: number;
  progressChain: Promise<void>;
}

export class PhotoCollector {
  private readonly batches = new Map<number, Batch>();

  add(
    userId: number,
    buffer: Buffer,
    onFlush: (buffers: Buffer[], progressMessageId?: number) => void | Promise<void>,
  ): { count: number; isFirst: boolean } {
    const existing = this.batches.get(userId);
    const batch = existing ?? { buffers: [], progressChain: Promise.resolve() };
    const isFirst = !existing;
    batch.buffers.push(buffer);

    if (batch.timer) {
      clearTimeout(batch.timer);
    }
    batch.timer = setTimeout(() => {
      const finished = this.batches.get(userId);
      if (!finished || finished !== batch) {
        return;
      }
      this.batches.delete(userId);
      void finished.progressChain
        .catch(() => undefined)
        .then(() => {
          if (finished.buffers.length) {
            return onFlush(finished.buffers, finished.progressMessageId);
          }
          return undefined;
        });
    }, PHOTO_BATCH_SETTLE_MS);

    this.batches.set(userId, batch);
    return { count: batch.buffers.length, isFirst };
  }

  async updateProgress(
    userId: number,
    render: (count: number, messageId?: number) => Promise<number | undefined>,
  ): Promise<void> {
    const batch = this.batches.get(userId);
    if (!batch) {
      return;
    }

    batch.progressChain = batch.progressChain
      .catch(() => undefined)
      .then(async () => {
        const current = this.batches.get(userId);
        if (!current) {
          return;
        }
        current.progressMessageId = await render(current.buffers.length, current.progressMessageId);
      });

    await batch.progressChain;
  }

  clear(userId: number): void {
    const batch = this.batches.get(userId);
    if (batch?.timer) {
      clearTimeout(batch.timer);
    }
    this.batches.delete(userId);
  }
}

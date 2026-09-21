import { randomUUID } from 'node:crypto';
import { MEDIA_GROUP_SETTLE_MS } from '../types.js';

interface Group<T> {
  items: T[];
  timer?: NodeJS.Timeout;
}

export class MediaGroupQueue<T> {
  private readonly groups = new Map<string, Group<T>>();

  enqueue(
    userId: number,
    mediaGroupId: string | undefined,
    item: T,
    onReady: (items: T[]) => void | Promise<void>,
  ): void {
    const key = mediaGroupId ? `${userId}:g:${mediaGroupId}` : `${userId}:s:${randomUUID()}`;
    const group = this.groups.get(key) ?? { items: [] };
    group.items.push(item);

    if (group.timer) {
      clearTimeout(group.timer);
    }

    group.timer = setTimeout(
      () => {
        this.groups.delete(key);
        void onReady(group.items);
      },
      mediaGroupId ? MEDIA_GROUP_SETTLE_MS : 0,
    );

    this.groups.set(key, group);
  }
}

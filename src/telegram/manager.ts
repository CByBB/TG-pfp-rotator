import { stat } from 'node:fs/promises';
import path from 'node:path';
import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { computeCheck } from 'telegram/Password.js';
import { CustomFile } from 'telegram/client/uploads.js';
import { StringSession } from 'telegram/sessions/index.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import type { UserStore } from '../storage/store.js';
import { getFloodWaitSeconds, getRpcMessage } from '../utils.js';

export class ClientManager {
  private readonly clients = new Map<number, TelegramClient>();
  private readonly locks = new Map<number, Promise<unknown>>();

  constructor(
    private readonly config: Config,
    private readonly store: UserStore,
    private readonly logger: Logger,
  ) {}

  async restoreAll(): Promise<void> {
    for (const user of this.store.listUsers()) {
      const session = await this.store.readSession(user.userId);
      if (!session) {
        continue;
      }
      try {
        await this.connectExisting(user.userId, session);
        this.logger.info('Restored Telegram session', { userId: user.userId });
      } catch (error) {
        this.logger.error('Failed to restore session', {
          userId: user.userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async beginLogin(userId: number, phone: string): Promise<{ viaApp: boolean }> {
    await this.disconnect(userId);
    const client = this.createClient('');
    await client.connect();
    this.clients.set(userId, client);

    const sent = await client.sendCode(
      { apiId: this.config.apiId, apiHash: this.config.apiHash },
      phone,
    );

    await this.store.update(userId, {
      phone,
      phoneCodeHash: sent.phoneCodeHash,
    });

    return { viaApp: sent.isCodeViaApp };
  }

  async submitCode(
    userId: number,
    code: string,
  ): Promise<{ ok: true } | { needsPassword: true } | { error: string }> {
    const client = this.clients.get(userId);
    const user = this.store.get(userId);
    if (!client || !user?.phone || !user.phoneCodeHash) {
      return { error: 'Login session expired. Send /start and share your phone number again.' };
    }

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: user.phone,
          phoneCodeHash: user.phoneCodeHash,
          phoneCode: code,
        }),
      );
      await this.persistSession(userId, client);
      return { ok: true };
    } catch (error) {
      const rpc = getRpcMessage(error);
      if (rpc === 'SESSION_PASSWORD_NEEDED') {
        return { needsPassword: true };
      }
      if (rpc === 'PHONE_CODE_INVALID') {
        return { error: 'That code is invalid. Check the digits and try again.' };
      }
      if (rpc === 'PHONE_CODE_EXPIRED') {
        return { error: 'That code expired. Send /start and share your number again.' };
      }
      this.logger.error('Sign-in failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error: 'Could not verify that code. Send /start to try again.' };
    }
  }

  async submitPassword(
    userId: number,
    password: string,
  ): Promise<{ ok: true } | { error: string }> {
    const client = this.clients.get(userId);
    if (!client) {
      return { error: 'Login session expired. Send /start and share your phone number again.' };
    }

    try {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());
      await client.invoke(
        new Api.auth.CheckPassword({
          password: await computeCheck(passwordInfo, password),
        }),
      );
      await this.persistSession(userId, client);
      return { ok: true };
    } catch (error) {
      const rpc = getRpcMessage(error);
      if (rpc === 'PASSWORD_HASH_INVALID') {
        return { error: 'That 2FA password is incorrect. Please try again.' };
      }
      this.logger.error('2FA check failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error: 'Could not verify the 2FA password. Send /start to try again.' };
    }
  }

  async setProfilePhoto(userId: number, imagePath: string): Promise<void> {
    await this.withLock(userId, async () => {
      const client = await this.requireClient(userId);
      const fileStat = await stat(imagePath);
      const uploaded = await client.uploadFile({
        file: new CustomFile(path.basename(imagePath), fileStat.size, imagePath),
        workers: 1,
      });
      await client.invoke(new Api.photos.UploadProfilePhoto({ file: uploaded }));
      await this.deleteOlderProfilePhotos(client);
    });
  }

  async disconnect(userId: number): Promise<void> {
    const client = this.clients.get(userId);
    if (!client) {
      return;
    }
    this.clients.delete(userId);
    try {
      await client.disconnect();
    } catch {
      // already closed
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.all([...this.clients.keys()].map((userId) => this.disconnect(userId)));
  }

  isConnected(userId: number): boolean {
    return this.clients.has(userId);
  }

  describeSetPhotoError(error: unknown): string {
    const wait = getFloodWaitSeconds(error);
    if (wait) {
      return `Telegram asked to wait ${wait} seconds before changing the profile photo again.`;
    }
    return error instanceof Error ? error.message : 'Unknown profile photo error';
  }

  private async requireClient(userId: number): Promise<TelegramClient> {
    const existing = this.clients.get(userId);
    if (existing) {
      return existing;
    }
    const session = await this.store.readSession(userId);
    if (!session) {
      throw new Error('Not logged in');
    }
    return this.connectExisting(userId, session);
  }

  private async connectExisting(userId: number, session: string): Promise<TelegramClient> {
    const client = this.createClient(session);
    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) {
      await client.disconnect();
      throw new Error('Saved session is no longer authorized');
    }
    this.clients.set(userId, client);
    return client;
  }

  private createClient(session: string): TelegramClient {
    return new TelegramClient(new StringSession(session), this.config.apiId, this.config.apiHash, {
      connectionRetries: 5,
      deviceModel: 'PFP Rotator',
      appVersion: '1.0.0',
    });
  }

  private async persistSession(userId: number, client: TelegramClient): Promise<void> {
    const session = client.session;
    const saved = session instanceof StringSession ? session.save() : '';
    if (saved.length > 0) {
      await this.store.writeSession(userId, saved);
    }
    await this.store.update(userId, { phoneCodeHash: undefined });
  }

  private async deleteOlderProfilePhotos(client: TelegramClient): Promise<void> {
    try {
      const photos = await client.invoke(
        new Api.photos.GetUserPhotos({
          userId: new Api.InputUserSelf(),
          offset: 0,
          maxId: bigInt.zero,
          limit: 8,
        }),
      );
      const extras = photos.photos.slice(1).flatMap((photo) => {
        if (photo instanceof Api.Photo) {
          return [
            new Api.InputPhoto({
              id: photo.id,
              accessHash: photo.accessHash,
              fileReference: photo.fileReference,
            }),
          ];
        }
        return [];
      });
      if (extras.length > 0) {
        await client.invoke(new Api.photos.DeletePhotos({ id: extras }));
      }
    } catch (error) {
      this.logger.warn('Could not prune old profile photos', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async withLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(userId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      userId,
      previous.catch(() => undefined).then(() => current),
    );
    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

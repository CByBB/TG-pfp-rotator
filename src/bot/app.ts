import type { Config } from '../config.js';
import type { PhotoCollector } from '../images/collector.js';
import type { MediaGroupQueue } from '../images/mediaGroup.js';
import type { Logger } from '../logger.js';
import type { Rotator } from '../rotator/rotator.js';
import type { UserStore } from '../storage/store.js';
import type { ClientManager } from '../telegram/manager.js';
import type { AuthMemoryStore } from './memory.js';

export interface App {
  config: Config;
  store: UserStore;
  clients: ClientManager;
  rotator: Rotator;
  logger: Logger;
  auth: AuthMemoryStore;
  collector: PhotoCollector;
  albums: MediaGroupQueue<string>;
}

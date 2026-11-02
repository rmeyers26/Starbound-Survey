// Storage back-ends behind one tiny interface, so SaveService doesn't care where bytes live.
import { log } from '../engine/log';

export interface KeyValueStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Keeps data in memory only. Used in tests, and as a last resort when IndexedDB is unusable. */
export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, unknown>();
  async get(key: string): Promise<unknown | undefined> {
    return this.data.get(key);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }
}

const DB_NAME = 'starbound-survey';
const STORE_NAME = 'kv';

/** Wraps an IndexedDB request in a Promise so we can use async/await. */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/** Resolves when a write transaction has really been committed to disk. */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class IndexedDBStore implements KeyValueStore {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static open(factory: IDBFactory = indexedDB, name: string = DB_NAME): Promise<IndexedDBStore> {
    return new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      // Runs the first time (or when the version number goes up): create the table.
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(new IndexedDBStore(request.result));
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB open was blocked'));
    });
  }

  async get(key: string): Promise<unknown | undefined> {
    const tx = this.db.transaction(STORE_NAME, 'readonly');
    return promisify(tx.objectStore(STORE_NAME).get(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    await committed(tx);
  }

  async delete(key: string): Promise<void> {
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    await committed(tx);
  }

  async keys(): Promise<string[]> {
    const tx = this.db.transaction(STORE_NAME, 'readonly');
    const keys = await promisify(tx.objectStore(STORE_NAME).getAllKeys());
    return keys.map(String);
  }
}

export interface OpenedStore {
  store: KeyValueStore;
  /** False when we had to fall back to memory: progress will be lost when the tab closes. */
  durable: boolean;
}

/** Opens IndexedDB, or falls back to memory (e.g. some private-browsing modes) without crashing. */
export async function openBestStore(): Promise<OpenedStore> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
    return { store: await IndexedDBStore.open(), durable: true };
  } catch (error) {
    log('IndexedDB unavailable, progress will not persist', error);
    return { store: new MemoryStore(), durable: false };
  }
}

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
      request.onsuccess = () => {
        const db = request.result;
        // Another tab (or the browser clearing site data, or a future version of the game) wants to
        // upgrade or delete this database. An open connection would block that forever, so we step
        // aside. Later writes from this tab will fail and show the "could not save" message.
        db.onversionchange = () => db.close();
        resolve(new IndexedDBStore(db));
      };
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

/** How long we wait for IndexedDB to open before giving up (some Safari versions can hang forever). */
export const OPEN_TIMEOUT_MS = 5000;

/**
 * Opens IndexedDB, or falls back to memory (e.g. some private-browsing modes, or a browser whose
 * IndexedDB hangs) without crashing or blocking the game from starting.
 * `open` and `timeoutMs` are parameters so tests can simulate a hang.
 */
export async function openBestStore(
  open: () => Promise<KeyValueStore> = () => {
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB is not available'));
    return IndexedDBStore.open();
  },
  timeoutMs: number = OPEN_TIMEOUT_MS,
): Promise<OpenedStore> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`IndexedDB did not open within ${timeoutMs} ms`)),
        timeoutMs,
      );
    });
    return { store: await Promise.race([open(), timeout]), durable: true };
  } catch (error) {
    log('IndexedDB unavailable, progress will not persist', error);
    return { store: new MemoryStore(), durable: false };
  } finally {
    clearTimeout(timer);
  }
}

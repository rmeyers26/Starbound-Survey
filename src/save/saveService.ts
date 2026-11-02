// The ONE place that reads and writes saves (spec: "All reads and writes go through one SaveService").
import { log } from '../engine/log';
import {
  SAVE_ID,
  SaveError,
  SaveTooNewError,
  createEmptySave,
  migrateSave,
  type SaveRecord,
} from './schema';
import { MemoryStore, type KeyValueStore } from './stores';

export type LoadStatus =
  | 'new' // nothing was saved yet: a fresh save was created
  | 'ok' // loaded fine
  | 'recovered' // the stored save was unusable: backed up, and a fresh save was created
  | 'unavailable'; // the store itself failed: running in memory only

export interface LoadResult {
  record: SaveRecord;
  status: LoadStatus;
  /** Key of the backup copy, when `status` is 'recovered'. */
  backupKey?: string;
}

const BACKUP_PREFIX = 'backup-';
const MAX_BACKUPS = 3;
const EXPORT_APP_ID = 'starbound-survey';
const MAX_IMPORT_BYTES = 1_000_000;

export class SaveService {
  private store: KeyValueStore;
  private readonly now: () => Date;
  private record: SaveRecord;
  /** Writes run one after another so two quick saves can never land out of order. */
  private queue: Promise<unknown> = Promise.resolve();
  private durableFlag: boolean;

  constructor(store: KeyValueStore, options: { now?: () => Date; durable?: boolean } = {}) {
    this.store = store;
    this.now = options.now ?? (() => new Date());
    this.durableFlag = options.durable ?? true;
    this.record = createEmptySave(this.now());
  }

  /** Is progress really being kept on disk (true), or only in memory (false)? */
  get durable(): boolean {
    return this.durableFlag;
  }

  get current(): SaveRecord {
    return this.record;
  }

  async load(): Promise<LoadResult> {
    let raw: unknown;
    try {
      raw = await this.store.get(SAVE_ID);
    } catch (error) {
      log('Reading the save failed; continuing in memory only', error);
      this.store = new MemoryStore();
      this.durableFlag = false;
      this.record = createEmptySave(this.now());
      return { record: this.record, status: 'unavailable' };
    }

    if (raw === undefined) {
      this.record = createEmptySave(this.now());
      return { record: this.record, status: 'new' };
    }

    try {
      this.record = migrateSave(raw);
      return { record: this.record, status: 'ok' };
    } catch (error) {
      if (!(error instanceof SaveError)) throw error;
      // Spec: a corrupted save is backed up, and the game starts fresh instead of failing.
      // (A save from a NEWER game version takes this same path, so it is never overwritten unseen.)
      const backupKey = await this.backup(
        raw,
        error instanceof SaveTooNewError ? 'newer' : 'corrupt',
      );
      this.record = createEmptySave(this.now());
      return { record: this.record, status: 'recovered', backupKey };
    }
  }

  /** Change the save with a function, then write it. The function receives the current record. */
  update(change: (record: SaveRecord) => SaveRecord): Promise<void> {
    this.record = { ...change(this.record), updatedAt: this.now().toISOString() };
    return this.persist();
  }

  /** Text for a backup file the player can keep. */
  exportJson(): string {
    return JSON.stringify(
      { app: EXPORT_APP_ID, exportedAt: this.now().toISOString(), save: this.record },
      null,
      2,
    );
  }

  /**
   * Replace the current save with a backup file's contents. Nothing changes if the file is bad.
   * The previous save is kept as a backup first.
   */
  async importJson(text: string): Promise<SaveRecord> {
    if (text.length > MAX_IMPORT_BYTES) throw new SaveError('Backup file is too large');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SaveError('Backup file is not valid JSON');
    }
    // Accept both our export wrapper ({ app, save }) and a bare save record.
    const payload =
      typeof parsed === 'object' && parsed !== null && 'save' in parsed
        ? (parsed as { save: unknown }).save
        : parsed;
    const imported = migrateSave(payload); // throws SaveError if unusable; nothing is changed yet

    await this.backup(this.record, 'before-import');
    this.record = { ...imported, updatedAt: this.now().toISOString() };
    await this.persist();
    return this.record;
  }

  /** Ask the browser not to evict our data. It may say no, so nothing depends on the answer. */
  async requestPersistence(): Promise<boolean> {
    try {
      if (!navigator.storage?.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  private persist(): Promise<void> {
    const snapshot = structuredClone(this.record);
    const write = this.queue.then(() => this.store.set(SAVE_ID, snapshot));
    // Keep the chain alive even if one write fails, and report the failure to the caller.
    this.queue = write.catch((error) => log('Saving failed', error));
    return write;
  }

  /** Stores a copy of `value` under a new key and keeps only the newest few backups. */
  private async backup(value: unknown, label: string): Promise<string> {
    const key = `${BACKUP_PREFIX}${this.now().toISOString()}-${label}`;
    try {
      await this.store.set(key, value);
      const backups = (await this.store.keys()).filter((k) => k.startsWith(BACKUP_PREFIX)).sort();
      for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
        await this.store.delete(old);
      }
    } catch (error) {
      log('Could not write a backup', error);
    }
    return key;
  }
}

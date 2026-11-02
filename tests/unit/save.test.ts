import 'fake-indexeddb/auto'; // gives Node a working IndexedDB so the real store code is tested
import { describe, it, expect, vi } from 'vitest';
import { recordInspection, countInspected } from '../../src/game/progress';
import { SaveService } from '../../src/save/saveService';
import {
  CURRENT_SAVE_VERSION,
  SaveError,
  SaveTooNewError,
  createEmptySave,
  migrateSave,
  validateSave,
} from '../../src/save/schema';
import { IndexedDBStore, MemoryStore, type KeyValueStore } from '../../src/save/stores';

const fixedNow = () => new Date('2026-11-01T12:00:00.000Z');

describe('validateSave / migrateSave', () => {
  it('accepts a fresh save', () => {
    expect(validateSave(createEmptySave(fixedNow()))).toEqual(createEmptySave(fixedNow()));
  });
  it('lists every problem it finds', () => {
    try {
      validateSave({ version: 1, updatedAt: 'nope', xp: -1, rank: '', scannedObjects: 3 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SaveError);
      expect((e as SaveError).problems.length).toBeGreaterThanOrEqual(5);
    }
  });
  it('drops unknown fields', () => {
    const cleaned = validateSave({ ...createEmptySave(), hacked: true });
    expect('hacked' in cleaned).toBe(false);
  });
  it('rejects non-objects and fractional counts', () => {
    expect(() => validateSave(null)).toThrow(SaveError);
    expect(() => validateSave({ ...createEmptySave(), inspectedObjects: { moon: 1.5 } })).toThrow(
      SaveError,
    );
  });
  it('runs migrations in order for an old save', () => {
    // A pretend "version 0" save used only by this test: it stored a list instead of a count map.
    const legacy = {
      xp: 10,
      rank: 'Cadet',
      inspected: ['moon', 'sun'],
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const migrated = migrateSave(legacy, {
      0: (d) => ({
        ...d,
        inspectedObjects: Object.fromEntries((d.inspected as string[]).map((id) => [id, 1])),
        scannedObjects: {},
        unlockedRegions: ['inner'],
        missions: {},
      }),
    });
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.inspectedObjects).toEqual({ moon: 1, sun: 1 });
    expect(migrated.xp).toBe(10);
  });
  it('says so plainly when a file is not one of our saves', () => {
    expect(() => migrateSave({ nope: 1 }, {})).toThrow(
      /does not look like a Starbound Survey save/,
    );
  });
  it('fails clearly when a needed migration is missing', () => {
    expect(() => migrateSave({ ...createEmptySave() }, {}, 2)).toThrow(
      /No migration from version 1/,
    );
  });
  it('refuses a save from a newer game version', () => {
    expect(() => migrateSave({ ...createEmptySave(), version: 99 })).toThrow(SaveTooNewError);
  });
});

describe('progress', () => {
  it('counts inspections without mutating the original', () => {
    const before = createEmptySave();
    const after = recordInspection(recordInspection(before, 'moon'), 'moon');
    expect(after.inspectedObjects.moon).toBe(2);
    expect(before.inspectedObjects.moon).toBeUndefined();
  });
  it('counts distinct inspected objects among known ids', () => {
    const r = recordInspection(recordInspection(createEmptySave(), 'moon'), 'sun');
    expect(countInspected(r, ['sun', 'earth', 'moon'])).toBe(2);
    expect(countInspected(r, ['earth'])).toBe(0);
  });
});

describe('SaveService', () => {
  it('starts new when nothing is stored', async () => {
    const s = new SaveService(new MemoryStore(), { now: fixedNow });
    expect((await s.load()).status).toBe('new');
  });
  it('saves and loads back (survives a "reload" with a new service on the same store)', async () => {
    const store = new MemoryStore();
    const first = new SaveService(store, { now: fixedNow });
    await first.load();
    await first.update((r) => recordInspection(r, 'moon'));

    const second = new SaveService(store, { now: fixedNow });
    const loaded = await second.load();
    expect(loaded.status).toBe('ok');
    expect(loaded.record.inspectedObjects).toEqual({ moon: 1 });
  });
  it('stamps updatedAt on every change', async () => {
    let t = 0;
    const s = new SaveService(new MemoryStore(), { now: () => new Date(2026, 0, 1, 0, 0, t++) });
    await s.load();
    const before = s.current.updatedAt;
    await s.update((r) => r);
    expect(s.current.updatedAt).not.toBe(before);
  });
  it('backs up a corrupt save and starts fresh instead of failing', async () => {
    const store = new MemoryStore();
    await store.set('progress', { version: 1, xp: 'lots' });
    const s = new SaveService(store, { now: fixedNow });
    const result = await s.load();
    expect(result.status).toBe('recovered');
    expect(await store.get(result.backupKey!)).toEqual({ version: 1, xp: 'lots' }); // kept, not discarded
    expect(result.record.xp).toBe(0);
  });
  it('keeps a save from a newer game version as a backup', async () => {
    const store = new MemoryStore();
    const newer = { ...createEmptySave(), version: 99 };
    await store.set('progress', newer);
    const result = await new SaveService(store, { now: fixedNow }).load();
    expect(result.status).toBe('recovered');
    expect(result.backupKey).toContain('newer');
    expect(await store.get(result.backupKey!)).toEqual(newer);
  });
  it('keeps only the 3 newest backups', async () => {
    const store = new MemoryStore();
    let t = 0;
    const s = new SaveService(store, { now: () => new Date(2026, 0, 1, 0, 0, t++) });
    for (let i = 0; i < 5; i++) {
      await store.set('progress', 'garbage');
      await s.load();
    }
    const backups = (await store.keys()).filter((k) => k.startsWith('backup-'));
    expect(backups).toHaveLength(3);
  });
  it('falls back to memory if the store fails to read', async () => {
    const broken: KeyValueStore = {
      get: () => Promise.reject(new Error('disk on fire')),
      set: () => Promise.reject(new Error('disk on fire')),
      delete: () => Promise.reject(new Error('x')),
      keys: () => Promise.reject(new Error('x')),
    };
    const s = new SaveService(broken, { now: fixedNow });
    const result = await s.load();
    expect(result.status).toBe('unavailable');
    expect(s.durable).toBe(false);
    await expect(s.update((r) => recordInspection(r, 'moon'))).resolves.toBeUndefined(); // memory store works
  });
  it('writes happen in order even when started together', async () => {
    const writes: number[] = [];
    const store = new MemoryStore();
    const slow: KeyValueStore = {
      ...store,
      get: (k) => store.get(k),
      keys: () => store.keys(),
      delete: (k) => store.delete(k),
      set: async (k, v) => {
        const xp = (v as { xp: number }).xp;
        await new Promise((r) => setTimeout(r, xp === 1 ? 20 : 1)); // first write is slower
        writes.push(xp);
        await store.set(k, v);
      },
    };
    const s = new SaveService(slow, { now: fixedNow });
    await s.load();
    await Promise.all([s.update((r) => ({ ...r, xp: 1 })), s.update((r) => ({ ...r, xp: 2 }))]);
    expect(writes).toEqual([1, 2]);
    expect(((await store.get('progress')) as { xp: number }).xp).toBe(2);
  });
});

describe('export / import', () => {
  it('round-trips through a backup file into a fresh store', async () => {
    const a = new SaveService(new MemoryStore(), { now: fixedNow });
    await a.load();
    await a.update((r) => recordInspection(recordInspection(r, 'moon'), 'earth'));
    const file = a.exportJson();

    const b = new SaveService(new MemoryStore(), { now: fixedNow });
    await b.load();
    await b.importJson(file);
    expect(b.current.inspectedObjects).toEqual({ moon: 1, earth: 1 });
  });
  it('accepts a bare save record as well as the export wrapper', async () => {
    const s = new SaveService(new MemoryStore(), { now: fixedNow });
    await s.load();
    const bare = JSON.stringify(recordInspection(createEmptySave(), 'sun'));
    await s.importJson(bare);
    expect(s.current.inspectedObjects).toEqual({ sun: 1 });
  });
  it('rejects bad files and leaves the current save untouched', async () => {
    const s = new SaveService(new MemoryStore(), { now: fixedNow });
    await s.load();
    await s.update((r) => recordInspection(r, 'moon'));
    await expect(s.importJson('not json')).rejects.toThrow(/not valid JSON/);
    await expect(s.importJson('{"save":{"version":1}}')).rejects.toThrow(SaveError);
    await expect(s.importJson('x'.repeat(2_000_000))).rejects.toThrow(/too large/);
    expect(s.current.inspectedObjects).toEqual({ moon: 1 });
  });
  it('keeps the previous save as a backup when importing', async () => {
    const store = new MemoryStore();
    const s = new SaveService(store, { now: fixedNow });
    await s.load();
    await s.update((r) => recordInspection(r, 'moon'));
    await s.importJson(JSON.stringify(createEmptySave()));
    const backupKey = (await store.keys()).find((k) => k.includes('before-import'))!;
    expect(((await store.get(backupKey)) as { inspectedObjects: object }).inspectedObjects).toEqual(
      { moon: 1 },
    );
  });
});

describe('IndexedDBStore (real IndexedDB code path)', () => {
  it('stores, reads, lists and deletes values', async () => {
    const store = await IndexedDBStore.open(indexedDB, 'test-db-1');
    await store.set('a', { n: 1 });
    await store.set('b', 'text');
    expect(await store.get('a')).toEqual({ n: 1 });
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.delete('a');
    expect(await store.get('a')).toBeUndefined();
  });
  it('data survives closing and reopening the database', async () => {
    const first = await IndexedDBStore.open(indexedDB, 'test-db-2');
    await first.set('progress', createEmptySave(fixedNow()));
    const reopened = await IndexedDBStore.open(indexedDB, 'test-db-2');
    expect(await reopened.get('progress')).toEqual(createEmptySave(fixedNow()));
  });
  it('works end to end with SaveService', async () => {
    const store = await IndexedDBStore.open(indexedDB, 'test-db-3');
    const s = new SaveService(store, { now: fixedNow });
    await s.load();
    await s.update((r) => recordInspection(r, 'sun'));
    const again = new SaveService(await IndexedDBStore.open(indexedDB, 'test-db-3'), {
      now: fixedNow,
    });
    expect((await again.load()).record.inspectedObjects).toEqual({ sun: 1 });
  });
});

describe('requestPersistence', () => {
  it('returns false (not an error) when the browser has no storage API', async () => {
    const s = new SaveService(new MemoryStore());
    vi.stubGlobal('navigator', {});
    expect(await s.requestPersistence()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('openBestStore', () => {
  it('uses the real store when it opens in time', async () => {
    const { openBestStore } = await import('../../src/save/stores');
    const result = await openBestStore(() => Promise.resolve(new MemoryStore()), 50);
    expect(result.durable).toBe(true);
  });
  it('falls back to memory when IndexedDB hangs forever', async () => {
    const { openBestStore } = await import('../../src/save/stores');
    const hangs = () => new Promise<KeyValueStore>(() => {}); // never settles
    const result = await openBestStore(hangs, 30);
    expect(result.durable).toBe(false);
  });
  it('falls back to memory when opening throws', async () => {
    const { openBestStore } = await import('../../src/save/stores');
    const result = await openBestStore(() => Promise.reject(new Error('private mode')), 50);
    expect(result.durable).toBe(false);
  });
});

describe('IndexedDBStore and other tabs / storage clearing', () => {
  /** Tries to delete the database; reports whether it was blocked by an open connection. */
  function deleteDb(name: string): Promise<'deleted' | 'blocked'> {
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve('deleted');
      request.onblocked = () => resolve('blocked');
      request.onerror = () => resolve('blocked');
    });
  }

  it('closes its connection when another context wants to delete or upgrade the database', async () => {
    // Without this, an open game tab would block deletion (and future upgrades) forever.
    await IndexedDBStore.open(indexedDB, 'test-db-versionchange');
    expect(await deleteDb('test-db-versionchange')).toBe('deleted');
  });
});

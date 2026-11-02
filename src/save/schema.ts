// The shape of a saved game, plus the rules for checking and upgrading old saves.
// Spec: every record has a `version`, an `updatedAt` timestamp and a stable id; old saves are
// upgraded by migrations and never discarded; a corrupted save is backed up, never fatal.

export const CURRENT_SAVE_VERSION = 1;
export const SAVE_ID = 'progress'; // the stable key the single save record lives under

export interface SaveRecord {
  version: number;
  updatedAt: string; // ISO 8601 date-time, e.g. "2026-11-01T12:00:00.000Z"
  xp: number;
  rank: string;
  /** Scan tiers reached per object. Used from Phase 1 (scanning). */
  scannedObjects: Record<string, number>;
  /** Prototype progress: how many times each object was inspected (selected). */
  inspectedObjects: Record<string, number>;
  unlockedRegions: string[];
  missions: Record<string, string>;
}

/** Thrown when a save cannot be understood (corrupt, wrong shape, not JSON). */
export class SaveError extends Error {
  readonly problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(problems.length > 0 ? `${message}: ${problems.join('; ')}` : message);
    this.name = 'SaveError';
    this.problems = problems;
  }
}

/** Thrown when a save comes from a NEWER version of the game than this code understands. */
export class SaveTooNewError extends SaveError {
  constructor(version: number) {
    super(
      `Save is from a newer game version (${version}); this version understands up to ${CURRENT_SAVE_VERSION}`,
    );
    this.name = 'SaveTooNewError';
  }
}

export function createEmptySave(now: Date = new Date()): SaveRecord {
  return {
    version: CURRENT_SAVE_VERSION,
    updatedAt: now.toISOString(),
    xp: 0,
    rank: 'Cadet',
    scannedObjects: {},
    inspectedObjects: {},
    unlockedRegions: ['inner'],
    missions: {},
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A map like { moon: 2 } where every value is a whole number >= 0. */
function checkCountMap(name: string, value: unknown, problems: string[]): Record<string, number> {
  if (!isRecord(value)) {
    problems.push(`${name} must be an object`);
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isInteger(count) && count >= 0) result[key] = count;
    else problems.push(`${name}.${key} must be a whole number >= 0`);
  }
  return result;
}

/** Checks a record that claims to be the CURRENT version. Returns a clean copy (unknown fields dropped). */
export function validateSave(raw: unknown): SaveRecord {
  const problems: string[] = [];
  if (!isRecord(raw)) throw new SaveError('Save must be an object');

  if (raw.version !== CURRENT_SAVE_VERSION)
    problems.push(`version must be ${CURRENT_SAVE_VERSION}`);
  if (typeof raw.updatedAt !== 'string' || Number.isNaN(Date.parse(raw.updatedAt))) {
    problems.push('updatedAt must be a date string');
  }
  if (typeof raw.xp !== 'number' || !Number.isFinite(raw.xp) || raw.xp < 0)
    problems.push('xp must be a number >= 0');
  if (typeof raw.rank !== 'string' || raw.rank.trim() === '')
    problems.push('rank must be a non-empty string');

  const scannedObjects = checkCountMap('scannedObjects', raw.scannedObjects, problems);
  const inspectedObjects = checkCountMap('inspectedObjects', raw.inspectedObjects, problems);

  let unlockedRegions: string[] = [];
  if (
    Array.isArray(raw.unlockedRegions) &&
    raw.unlockedRegions.every((r) => typeof r === 'string')
  ) {
    unlockedRegions = raw.unlockedRegions as string[];
  } else {
    problems.push('unlockedRegions must be a list of strings');
  }

  const missions: Record<string, string> = {};
  if (isRecord(raw.missions)) {
    for (const [id, state] of Object.entries(raw.missions)) {
      if (typeof state === 'string') missions[id] = state;
      else problems.push(`missions.${id} must be a string`);
    }
  } else {
    problems.push('missions must be an object');
  }

  if (problems.length > 0) throw new SaveError('Invalid save', problems);
  return {
    version: CURRENT_SAVE_VERSION,
    updatedAt: raw.updatedAt as string,
    xp: raw.xp as number,
    rank: raw.rank as string,
    scannedObjects,
    inspectedObjects,
    unlockedRegions,
    missions,
  };
}

/** One step of an upgrade: takes a version-N record, returns the version-(N+1) shape. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Upgrade table, keyed by the version it upgrades FROM. Empty today because version 1 is the first
 * version. When the shape changes, bump CURRENT_SAVE_VERSION and add `1: (data) => ({ ...data, ... })`.
 */
export const MIGRATIONS: Record<number, Migration> = {};

/** Runs every needed migration, then validates. Parameters exist so tests can use their own table. */
export function migrateSave(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  currentVersion: number = CURRENT_SAVE_VERSION,
): SaveRecord {
  if (!isRecord(raw)) throw new SaveError('Save must be an object');
  // A save with no version is treated as version 0 (the oldest possible shape).
  let version = typeof raw.version === 'number' && Number.isInteger(raw.version) ? raw.version : 0;
  if (version > currentVersion) throw new SaveTooNewError(version);

  let data: Record<string, unknown> = { ...raw };
  while (version < currentVersion) {
    const step = migrations[version];
    if (!step) {
      // No version field at all usually means "this isn't one of our files", not "an old save".
      throw new SaveError(
        typeof raw.version === 'number'
          ? `No migration from version ${version}`
          : 'This does not look like a Starbound Survey save',
      );
    }
    data = { ...step(data), version: version + 1 };
    version += 1;
  }
  return validateSave(data);
}

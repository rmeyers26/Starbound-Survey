// Goals and achievements: the "what should I do next?" and "well done!" parts of the game.
//
// Everything here is a PURE function of the saved progress (a SaveRecord) and the object list: no screen code, no
// storage, no timers. That makes it easy to test, and it means achievements need NO new data in the save file:
// whether you have earned "Comet Chaser" is worked out from which objects you have scanned.
import type { SaveRecord } from '../save/schema';
import { progressToNextRank, rankIndexForXp } from './ranks';
import { regionHasObjects, unlockedObjects } from './regions';
import { nextScanTier, scannerTierFor, XP_FIRST_SCAN, XP_HIGHER_TIER } from './scoring';
import { objectMaxTier } from './tiers';
import type { CelestialObject } from './types';

// ---------------------------------------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------------------------------------

export interface Goal {
  /** One short sentence for the HUD. */
  text: string;
  /** The object to fly to when the player taps the goal, or null when there is nothing to fly to. */
  targetId: string | null;
}

/**
 * The single best next step for this player.
 *  1. Brand new (nothing scanned): a welcome that says how scanning works, aimed at Earth.
 *  2. Something never scanned in an unlocked region: scan it (+20 XP).
 *  3. Everything scanned once, but this scanner can look deeper: scan one again (+10 XP).
 *  4. A higher rank would allow deeper scans: say how much XP is missing.
 *  5. Nothing left: say so honestly (new objects arrive in future updates), instead of a dead end.
 */
export function nextGoal(record: SaveRecord, objects: CelestialObject[]): Goal {
  const available = unlockedObjects(objects, record);
  const reached = (o: CelestialObject): number => record.scannedObjects[o.id] ?? 0;
  const scannerTier = scannerTierFor(record);

  if (available.every((o) => reached(o) === 0)) {
    const start = available.find((o) => o.id === 'earth') ?? available[0];
    if (!start) return { text: 'Nothing to scan yet.', targetId: null };
    return {
      text: `Welcome, ${record.rank}! Tap ${start.name}, fly close, then hold SCAN.`,
      targetId: start.id,
    };
  }

  const unscanned = available.find((o) => reached(o) === 0);
  if (unscanned) {
    return { text: `Scan ${unscanned.name} (+${XP_FIRST_SCAN} XP)`, targetId: unscanned.id };
  }

  const deeper = available.find(
    (o) => nextScanTier(reached(o), scannerTier, objectMaxTier(o)) !== null,
  );
  if (deeper) {
    return {
      text: `Scan ${deeper.name} again for a deeper look (+${XP_HIGHER_TIER} XP)`,
      targetId: deeper.id,
    };
  }

  const progress = progressToNextRank(record.xp);
  const stillAhead = progress.next !== null && scannerTier < 3;
  if (stillAhead && progress.next) {
    return {
      text: `${progress.next.xp - record.xp} XP to ${progress.next.name}, which allows deeper scans.`,
      targetId: null,
    };
  }
  return {
    text: 'You have scanned everything in the game so far. New objects arrive in future updates.',
    targetId: null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  /** Says how to earn it (shown in the Logbook, also while it is still locked). */
  hint: string;
  /** Object ids this achievement is about (a test checks that every one exists in the data). */
  ids?: readonly string[];
  /** True once the player has earned it. */
  earned(context: AchievementContext): boolean;
}

export interface AchievementContext {
  record: SaveRecord;
  objects: CelestialObject[];
}

const scannedAtAll = (c: AchievementContext, id: string): boolean =>
  (c.record.scannedObjects[id] ?? 0) > 0;

const GIANTS = ['jupiter', 'saturn', 'uranus', 'neptune'] as const;
const HOME = ['earth', 'moon'] as const;
const MOON_COLLECTOR_COUNT = 10;
const FULL_SPECTRUM_COUNT = 10;

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-light',
    title: 'First Light',
    hint: 'Complete your first scan.',
    earned: (c) => Object.values(c.record.scannedObjects).some((tier) => tier > 0),
  },
  {
    id: 'home-sweet-home',
    title: 'Home Sweet Home',
    hint: 'Scan Earth and the Moon.',
    ids: HOME,
    earned: (c) => HOME.every((id) => scannedAtAll(c, id)),
  },
  {
    id: 'rising-star',
    title: 'Rising Star',
    hint: 'Reach the rank of Navigator.',
    earned: (c) => rankIndexForXp(c.record.xp) >= 1,
  },
  {
    id: 'inner-surveyor',
    title: 'Inner System Surveyor',
    hint: 'Scan every object in the inner Solar System.',
    earned: (c) =>
      c.objects.filter((o) => o.region === 'inner').every((o) => scannedAtAll(c, o.id)),
  },
  {
    id: 'comet-chaser',
    title: 'Comet Chaser',
    hint: 'Scan comet C/2026 A2 (Bok).',
    ids: ['c2026a2'],
    earned: (c) => scannedAtAll(c, 'c2026a2'),
  },
  {
    id: 'giant-hunter',
    title: 'Giant Hunter',
    hint: 'Scan all four giant planets.',
    ids: GIANTS,
    earned: (c) => GIANTS.every((id) => scannedAtAll(c, id)),
  },
  {
    id: 'moon-collector',
    title: 'Moon Collector',
    hint: `Scan ${MOON_COLLECTOR_COUNT} different moons.`,
    earned: (c) =>
      c.objects.filter((o) => o.type === 'moon' && scannedAtAll(c, o.id)).length >=
      MOON_COLLECTOR_COUNT,
  },
  {
    id: 'deep-look',
    title: 'Deep Look',
    hint: 'Complete a spectral (deepest) scan.',
    earned: (c) => Object.values(c.record.scannedObjects).some((tier) => tier >= 3),
  },
  {
    id: 'full-spectrum',
    title: 'Full Spectrum',
    hint: `Scan ${FULL_SPECTRUM_COUNT} objects as deeply as they can be scanned.`,
    earned: (c) =>
      c.objects.filter((o) => (c.record.scannedObjects[o.id] ?? 0) >= objectMaxTier(o)).length >=
      FULL_SPECTRUM_COUNT,
  },
  {
    id: 'whole-system',
    title: 'The Whole System',
    hint: 'Scan every object in the game at least once.',
    earned: (c) => c.objects.every((o) => scannedAtAll(c, o.id)),
  },
];

/** The ids of the achievements this player has earned. */
export function earnedAchievementIds(record: SaveRecord, objects: CelestialObject[]): Set<string> {
  const context = { record, objects };
  return new Set(ACHIEVEMENTS.filter((a) => a.earned(context)).map((a) => a.id));
}

/** The achievements earned in `after` that were not yet earned in `before` (in the list's order). */
export function newlyEarned(
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => after.has(a.id) && !before.has(a.id));
}

/** Names the regions of `newRegions` that contain at least one object, so a rank-up never announces an empty place. */
export function regionsWithObjects(newRegions: string[], objects: CelestialObject[]): string[] {
  return newRegions.filter((region) => regionHasObjects(region, objects));
}

/**
 * The message shown on a rank-up. It names only the new regions that really hold something to scan:
 * announcing "New region unlocked: Kuiper Belt" when nothing is there yet would send the player looking for it.
 * `nameOf` turns a region id into the words shown to the player (kept out of this file so it stays free of UI code).
 */
export function rankUpMessage(
  rank: string,
  newRegions: string[],
  objects: CelestialObject[],
  nameOf: (region: string) => string,
): string {
  const named = regionsWithObjects(newRegions, objects).map(nameOf).join(', ');
  return `Rank up! You are now a ${rank}.${named ? ` New region unlocked: ${named}.` : ''}`;
}

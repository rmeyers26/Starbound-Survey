import { describe, expect, it } from 'vitest';
import realData from '../../data/objects.json';
import {
  ACHIEVEMENTS,
  earnedAchievementIds,
  newlyEarned,
  achievementMessage,
  nextGoal,
  rankUpMessage,
  regionsWithObjects,
} from '../../src/game/goals';
import { RANKS, regionsUnlockedAt } from '../../src/game/ranks';
import { applyScan } from '../../src/game/scoring';
import { objectMaxTier } from '../../src/game/tiers';
import { validateObjects } from '../../src/game/validateObjects';
import { createEmptySave, type SaveRecord } from '../../src/save/schema';

const objects = validateObjects(realData);
const byId = new Map(objects.map((o) => [o.id, o]));

/** A save that starts the way a new player does: Cadet, only the inner region. */
const fresh = (): SaveRecord => ({
  ...createEmptySave(new Date('2026-01-01T00:00:00.000Z')),
  unlockedRegions: ['inner'],
});

/** Scans `id` through every tier the data allows, using the real scoring rules (so XP and rank-ups are real). */
function scanFully(record: SaveRecord, id: string): SaveRecord {
  let next = record;
  for (let tier = 1; tier <= objectMaxTier(byId.get(id)!); tier++) {
    next = applyScan(next, id, tier).record;
  }
  return next;
}

/** A save where every object has been scanned as deeply as the data allows. */
function everythingScanned(): SaveRecord {
  let record = fresh();
  // Two passes: the first can rank up and unlock regions, so objects scanned "too early" are caught on the second.
  for (let pass = 0; pass < 2; pass++) {
    for (const o of objects) {
      if (record.unlockedRegions.includes(o.region)) record = scanFully(record, o.id);
    }
  }
  return record;
}

describe('nextGoal', () => {
  it('welcomes a brand-new player and points at Earth', () => {
    const goal = nextGoal(fresh(), objects);
    expect(goal.targetId).toBe('earth');
    expect(goal.text).toContain('Welcome');
    expect(goal.text).toContain('hold SCAN');
  });

  it('after the first scan, names the first unscanned object in order, with its XP', () => {
    const record = scanFully(fresh(), 'earth');
    const goal = nextGoal(record, objects);
    // The data lists the Sun first, so it is the first unscanned object.
    expect(goal.targetId).toBe('sun');
    expect(goal.text).toBe('Scan The Sun (+20 XP)');
  });

  it('never points at a locked object', () => {
    const record = scanFully(fresh(), 'earth');
    const target = byId.get(nextGoal(record, objects).targetId!)!;
    expect(record.unlockedRegions).toContain(target.region);
  });

  it('moves on to the next object once the current goal is scanned', () => {
    let record = scanFully(fresh(), 'earth');
    const first = nextGoal(record, objects).targetId!;
    record = scanFully(record, first);
    expect(nextGoal(record, objects).targetId).not.toBe(first);
  });

  it('when every unlocked object is scanned once but deeper scans exist, asks for a deeper look (+10 XP)', () => {
    let record = fresh();
    for (const o of objects.filter((o) => o.region === 'inner')) {
      record = applyScan(record, o.id, 1).record; // first tier only
    }
    // 220 XP is enough to rank up, so the outer region is open and has unscanned objects: scan those first.
    expect(record.unlockedRegions).toContain('outer');
    for (const o of objects.filter((o) => record.unlockedRegions.includes(o.region))) {
      record = applyScan(record, o.id, 1).record;
    }
    const goal = nextGoal(record, objects);
    expect(goal.text).toMatch(/again for a deeper look \(\+10 XP\)/);
    expect(goal.targetId).not.toBeNull();
  });

  it('ends honestly when everything is scanned: no dead end, no made-up XP target', () => {
    const goal = nextGoal(everythingScanned(), objects);
    expect(goal.targetId).toBeNull();
    expect(goal.text).toContain('scanned everything');
    expect(goal.text).not.toMatch(/\+\d+ XP/);
  });

  it('says so when there is nothing at all to scan', () => {
    const goal = nextGoal({ ...fresh(), unlockedRegions: [] }, objects);
    expect(goal.targetId).toBeNull();
  });
});

describe('achievements', () => {
  it('every achievement has a unique id, a title and a hint', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length, a.id).toBeGreaterThan(2);
      expect(a.hint.length, a.id).toBeGreaterThan(5);
    }
  });

  it('every object an achievement is about exists in the data (a typo would make it unearnable)', () => {
    for (const a of ACHIEVEMENTS) {
      for (const id of a.ids ?? []) expect(byId.has(id), `${a.id} mentions "${id}"`).toBe(true);
    }
  });

  it('no hint names an object from a region a new player cannot reach (the Logbook never mentions locked things)', () => {
    const lockedAtStart = objects.filter((o) => !fresh().unlockedRegions.includes(o.region));
    expect(lockedAtStart.length).toBeGreaterThan(0);
    for (const a of ACHIEVEMENTS) {
      for (const o of lockedAtStart) {
        expect(a.hint, `${a.id} names ${o.name}`).not.toContain(o.name);
      }
    }
  });

  it('a new player has earned none', () => {
    expect([...earnedAchievementIds(fresh(), objects)]).toEqual([]);
  });

  it('every achievement can be earned: a player who scanned everything has them all', () => {
    const earned = earnedAchievementIds(everythingScanned(), objects);
    const missing = ACHIEVEMENTS.filter((a) => !earned.has(a.id)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it('First Light comes from the first scan', () => {
    const record = applyScan(fresh(), 'mars', 1).record;
    expect(earnedAchievementIds(record, objects).has('first-light')).toBe(true);
  });

  it('Home Sweet Home needs BOTH Earth and the Moon', () => {
    const earthOnly = applyScan(fresh(), 'earth', 1).record;
    expect(earnedAchievementIds(earthOnly, objects).has('home-sweet-home')).toBe(false);
    const both = applyScan(earthOnly, 'moon', 1).record;
    expect(earnedAchievementIds(both, objects).has('home-sweet-home')).toBe(true);
  });

  it('Comet Chaser comes from scanning the comet', () => {
    const record = applyScan(fresh(), 'c2026a2', 1).record;
    expect(earnedAchievementIds(record, objects).has('comet-chaser')).toBe(true);
  });

  it('Moon Collector needs ten different moons, not ten scans of one', () => {
    const moons = objects.filter((o) => o.type === 'moon').map((o) => o.id);
    let record = { ...fresh(), unlockedRegions: ['inner', 'outer'] };
    for (const id of moons.slice(0, 9)) record = applyScan(record, id, 1).record;
    expect(earnedAchievementIds(record, objects).has('moon-collector')).toBe(false);
    record = applyScan(record, moons[9], 1).record;
    expect(earnedAchievementIds(record, objects).has('moon-collector')).toBe(true);
  });

  it('Rising Star comes from reaching Navigator, and not before', () => {
    const justShort = { ...fresh(), xp: RANKS[1].xp - 1 };
    expect(earnedAchievementIds(justShort, objects).has('rising-star')).toBe(false);
    const there = { ...fresh(), xp: RANKS[1].xp };
    expect(earnedAchievementIds(there, objects).has('rising-star')).toBe(true);
  });

  it('Deep Look needs a spectral (tier 3) scan', () => {
    const basic = applyScan(fresh(), 'earth', 1).record;
    expect(earnedAchievementIds(basic, objects).has('deep-look')).toBe(false);
    const spectral = { ...basic, scannedObjects: { ...basic.scannedObjects, earth: 3 } };
    expect(earnedAchievementIds(spectral, objects).has('deep-look')).toBe(true);
  });
});

describe('newlyEarned', () => {
  it('lists only what was earned since before, in the list order', () => {
    const before = earnedAchievementIds(fresh(), objects);
    const after = earnedAchievementIds(applyScan(fresh(), 'earth', 1).record, objects);
    expect(newlyEarned(before, after).map((a) => a.id)).toEqual(['first-light']);
  });

  it('is empty when nothing changed (so a repeat scan never congratulates twice)', () => {
    const record = applyScan(fresh(), 'earth', 1).record;
    const earned = earnedAchievementIds(record, objects);
    expect(newlyEarned(earned, earnedAchievementIds(record, objects))).toEqual([]);
  });
});

describe('regionsWithObjects', () => {
  it('drops regions that hold no objects, so a rank-up never announces an empty place', () => {
    expect(regionsWithObjects(['outer', 'kuiper', 'stars'], objects)).toEqual(['outer']);
  });

  it('proves the problem it solves: the data has regions that are unlocked but empty', () => {
    const everUnlocked = regionsUnlockedAt(RANKS.length - 1);
    const empty = everUnlocked.filter((r) => !objects.some((o) => o.region === r));
    expect(empty.length).toBeGreaterThan(0);
  });
});

describe('rankUpMessage', () => {
  const nameOf = (region: string): string =>
    ({ outer: 'Outer Solar System', kuiper: 'Kuiper Belt' })[region] ?? region;

  it('names a new region that has objects in it', () => {
    expect(rankUpMessage('Navigator', ['outer'], objects, nameOf)).toBe(
      'Rank up! You are now a Navigator. New region unlocked: Outer Solar System.',
    );
  });

  it('says nothing about a region that is still empty (Surveyor opens Kuiper Belt and stars: no objects yet)', () => {
    const message = rankUpMessage('Surveyor', ['kuiper', 'stars'], objects, nameOf);
    expect(message).toBe('Rank up! You are now a Surveyor.');
    expect(message).not.toContain('Kuiper');
  });

  it('names only the regions that have objects when a rank opens several', () => {
    expect(rankUpMessage('Surveyor', ['outer', 'kuiper'], objects, nameOf)).toBe(
      'Rank up! You are now a Surveyor. New region unlocked: Outer Solar System.',
    );
  });
});

describe('achievementMessage', () => {
  const find = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

  it('says nothing when nothing was earned', () => {
    expect(achievementMessage([])).toBeNull();
  });

  it('names one achievement and says how it was earned', () => {
    expect(achievementMessage([find('first-light')])).toBe(
      'Achievement earned: First Light. Complete your first scan.',
    );
  });

  it('puts several achievements in ONE message (the screen shows only two toasts, so more would push a rank-up off)', () => {
    const message = achievementMessage([find('rising-star'), find('inner-surveyor')]);
    expect(message).toBe('Achievements earned: Rising Star, Inner System Surveyor.');
  });
});

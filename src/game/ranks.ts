// Ranks, scanner levels and region unlocks (spec: "Progression"). Every number is a DESIGN CHOICE to
// tune in play-testing, not a fact about astronomy.

export interface RankDef {
  name: string;
  /** XP needed to reach this rank. */
  xp: number;
  /** Deepest scan tier this rank can perform (1 basic, 2 detailed, 3 spectral). */
  scannerTier: number;
  /** Regions this rank newly unlocks. */
  regions: string[];
}

export const RANKS: readonly RankDef[] = [
  { name: 'Cadet', xp: 0, scannerTier: 1, regions: ['inner'] },
  { name: 'Navigator', xp: 200, scannerTier: 2, regions: ['outer'] },
  { name: 'Surveyor', xp: 600, scannerTier: 3, regions: ['kuiper', 'stars'] },
  { name: 'Astronomer', xp: 1400, scannerTier: 3, regions: ['nebulae', 'clusters'] },
  { name: 'Director', xp: 2800, scannerTier: 3, regions: ['galaxies', 'extreme'] },
];

/** Index in RANKS of the highest rank reached with `xp` experience points. */
export function rankIndexForXp(xp: number): number {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (xp >= rank.xp) index = i;
  });
  return index;
}

export const rankForXp = (xp: number): RankDef => RANKS[rankIndexForXp(xp)];

/** Looks a rank up by name (as stored in the save). Unknown names fall back to the first rank. */
export function rankByName(name: string): RankDef {
  return RANKS.find((r) => r.name === name) ?? RANKS[0];
}

/** Every region unlocked by reaching rank number `index` (includes all lower ranks' regions). */
export function regionsUnlockedAt(index: number): string[] {
  return RANKS.slice(0, index + 1).flatMap((r) => r.regions);
}

/** The first rank able to perform a scan of `tier` (for "unlocks at Navigator" messages). */
export function firstRankForTier(tier: number): RankDef {
  return RANKS.find((r) => r.scannerTier >= tier) ?? RANKS[RANKS.length - 1];
}

export interface RankProgress {
  rank: RankDef;
  next: RankDef | null;
  /** 0..1 progress from this rank toward the next (1 at the top rank). */
  fraction: number;
}

export function progressToNextRank(xp: number): RankProgress {
  const index = rankIndexForXp(xp);
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  if (!next) return { rank, next: null, fraction: 1 };
  return { rank, next, fraction: (xp - rank.xp) / (next.xp - rank.xp) };
}

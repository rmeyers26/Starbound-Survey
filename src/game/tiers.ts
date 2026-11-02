// Helpers for "layered" scan data: which measurements a given scan level reveals.
import { SCAN_TIERS, type CelestialObject, type Measurement } from './types';

/** 'basic' -> 1, 'detailed' -> 2, 'spectral' -> 3. Measurements with no tier count as basic. */
export function tierNumber(measurement: Pick<Measurement, 'tier'>): number {
  return SCAN_TIERS.indexOf(measurement.tier ?? 'basic') + 1;
}

export const TIER_LABEL: Record<number, string> = { 1: 'Basic', 2: 'Detailed', 3: 'Spectral' };

/** The deepest tier this object has any data for (so we never offer a scan with nothing new). */
export function objectMaxTier(object: CelestialObject): number {
  return Math.max(1, ...Object.values(object.data).map(tierNumber));
}

export interface TierSplit {
  unlocked: Measurement[];
  locked: Measurement[];
}

/** Splits an object's measurements into those revealed at `scannedTier` and those still locked. */
export function splitByTier(object: CelestialObject, scannedTier: number): TierSplit {
  const unlocked: Measurement[] = [];
  const locked: Measurement[] = [];
  for (const m of Object.values(object.data))
    (tierNumber(m) <= scannedTier ? unlocked : locked).push(m);
  return { unlocked, locked };
}

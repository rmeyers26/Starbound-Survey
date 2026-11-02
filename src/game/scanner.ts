// The scan mechanic's rules (spec: "Scan mechanic"), kept free of DOM and timers so they can be
// unit tested exactly. The glue that runs it live is in scanController.ts.
import type { SaveRecord } from '../save/schema';
import { nextScanTier, scannerTierFor } from './scoring';
import type { GameState } from './stateMachine';
import { objectMaxTier } from './tiers';
import type { CelestialObject } from './types';

export const DEFAULT_SCAN_SECONDS = 3;
const MIN_SCAN_SECONDS = 0.2;
const MAX_SCAN_SECONDS = 10;

/** Reads the `?scanSeconds=` testing override from a URL query. Anything invalid gives the default. */
export function readScanSeconds(search: string): number {
  const raw = new URLSearchParams(search).get('scanSeconds');
  const value = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_SCAN_SECONDS;
  return Math.min(MAX_SCAN_SECONDS, Math.max(MIN_SCAN_SECONDS, value));
}

/** A scan in progress: a timer that fills a ring from 0 to 1 using wall-clock time. */
export class ScanSession {
  private startedAt: number | null = null;
  private readonly durationMs: number;

  constructor(durationSeconds: number) {
    this.durationMs = durationSeconds * 1000;
  }

  get active(): boolean {
    return this.startedAt !== null;
  }

  start(nowMs: number): void {
    this.startedAt = nowMs;
  }

  cancel(): void {
    this.startedAt = null;
  }

  /** Progress from 0 to 1 at time `nowMs`. Uses real elapsed time, so a slow phone still takes 3 s. */
  progress(nowMs: number): number {
    if (this.startedAt === null) return 0;
    return Math.min(1, Math.max(0, (nowMs - this.startedAt) / this.durationMs));
  }
}

/** Why a scan cannot start (shown to the player as a short message). */
export type ScanBlock = 'not-exploring' | 'no-selection' | 'too-far' | 'complete';

export const SCAN_BLOCK_MESSAGE: Record<ScanBlock, string> = {
  'not-exploring': 'Close the open screen before scanning.',
  'no-selection': 'Select an object to scan.',
  'too-far': 'Move closer to scan.',
  complete: 'Nothing new to learn here yet. Rank up to unlock a deeper scan.',
};

export type ScanCheck = { ok: true; tier: number } | { ok: false; reason: ScanBlock };

export interface ScanCheckInput {
  state: GameState;
  object: CelestialObject | undefined;
  record: SaveRecord;
  /** Distance from the ship (camera) to the object, in scene units; null when unknown. */
  distance: number | null;
  /** The farthest the scanner can reach for this object, in scene units. */
  range: number;
}

/** Decides whether a scan may start, and which tier it would reveal. */
export function checkScan(input: ScanCheckInput): ScanCheck {
  if (input.state !== 'EXPLORE') return { ok: false, reason: 'not-exploring' };
  if (!input.object) return { ok: false, reason: 'no-selection' };
  if (input.distance === null || input.distance > input.range)
    return { ok: false, reason: 'too-far' };
  const reached = input.record.scannedObjects[input.object.id] ?? 0;
  const tier = nextScanTier(reached, scannerTierFor(input.record), objectMaxTier(input.object));
  if (tier === null) return { ok: false, reason: 'complete' };
  return { ok: true, tier };
}

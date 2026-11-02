// Graphics profiles (spec: "High / Balanced / Performance") and the "ladder" the quality manager climbs.
// All numbers are STARTING VALUES to tune on real devices.
import type { ViewQuality } from './view';

export type ProfileName = 'high' | 'balanced' | 'performance';
export const PROFILE_NAMES: readonly ProfileName[] = ['high', 'balanced', 'performance'];

export interface Profile {
  label: string;
  /** If the average frame rate stays below this, the manager steps down. */
  stepDownBelowFps: number;
  pixelRatioCap: number;
  starCount: number;
}

export const PROFILES: Record<ProfileName, Profile> = {
  // High targets 60 FPS; we step down below 50 so normal vsync jitter doesn't trigger it.
  high: { label: 'High', stepDownBelowFps: 50, pixelRatioCap: 2, starCount: 4000 },
  balanced: { label: 'Balanced', stepDownBelowFps: 28, pixelRatioCap: 1.5, starCount: 2000 },
  performance: { label: 'Performance', stepDownBelowFps: 24, pixelRatioCap: 1, starCount: 800 },
};

/** Spec: lower the internal resolution first (100% -> 85% -> 70%) before reducing effects. */
export const RESOLUTION_STEPS: readonly number[] = [1, 0.85, 0.7];

export interface Level {
  profile: ProfileName;
  resolutionScale: number;
}

/** Best quality first. Index 0 = High @ 100%, last = Performance @ 70%. */
export const LADDER: readonly Level[] = PROFILE_NAMES.flatMap((profile) =>
  RESOLUTION_STEPS.map((resolutionScale) => ({ profile, resolutionScale })),
);

/** Index in the ladder of a profile at full resolution. */
export function ladderIndexFor(profile: ProfileName): number {
  return LADDER.findIndex((l) => l.profile === profile && l.resolutionScale === 1);
}

export function toViewQuality(level: Level): ViewQuality {
  const profile = PROFILES[level.profile];
  return {
    pixelRatioCap: profile.pixelRatioCap,
    resolutionScale: level.resolutionScale,
    starCount: profile.starCount,
  };
}

export interface DeviceHints {
  /** True on touch-first devices (phones, tablets): matchMedia('(pointer: coarse)'). */
  coarsePointer: boolean;
  /** navigator.deviceMemory (GB), when the browser reports it (Chrome only). */
  deviceMemoryGb?: number;
}

/** Spec: phones start on Balanced, desktops on High. Very low-memory devices start on Performance. */
export function defaultProfileFor(hints: DeviceHints): ProfileName {
  if (hints.deviceMemoryGb !== undefined && hints.deviceMemoryGb <= 2) return 'performance';
  return hints.coarsePointer ? 'balanced' : 'high';
}

export function readDeviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    deviceMemoryGb: nav.deviceMemory,
  };
}

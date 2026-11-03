// The rules for the visual effects (spec: "bloom, atmosphere, and warp effects ... with Reduce motion
// fallbacks"). Pure maths with no Three.js, so every number here can be tested exactly.
//
// Honest-science rule (spec): these effects are DECORATION. A glow around the Sun, a haze around a planet
// and streaks during a flight are artistic, not measurements, and the game labels its views "simulation".

// ---- Bloom (a soft glow around very bright things, like the Sun) --------------------------------------

/** How much bloom a graphics level uses. 'off' also means the post-processing code is never downloaded. */
export type BloomLevel = 'off' | 'reduced' | 'full';

export interface BloomSettings {
  /** How bright the glow is. */
  strength: number;
  /** How far the glow spreads (0 to 1). */
  radius: number;
  /** Only things brighter than this glow. Planets sit below it; the (boosted) Sun is above it. */
  threshold: number;
  /** 1 = work at full size; 0.5 = work at half size, which is about 4 times cheaper (spec: reduced bloom). */
  resolutionScale: number;
  /** Edge smoothing on the hidden picture (the normal screen smooths edges for free, a hidden picture does not). */
  msaaSamples: number;
}

export function bloomSettings(level: Exclude<BloomLevel, 'off'>): BloomSettings {
  return level === 'full'
    ? { strength: 0.7, radius: 0.55, threshold: 1.6, resolutionScale: 1, msaaSamples: 4 }
    : { strength: 0.45, radius: 0.45, threshold: 1.6, resolutionScale: 0.5, msaaSamples: 2 };
}

/**
 * The Sun is drawn with a flat, self-lit colour. With bloom on, that colour is multiplied above 1.0 ("brighter
 * than white") so it passes the glow threshold; with bloom off it must stay at 1.0 or the Sun would look
 * washed out to plain white.
 */
export function sunBrightness(level: BloomLevel): number {
  return level === 'off' ? 1 : 3;
}

// ---- Warp streaks (shown while the camera flies a long way) --------------------------------------------

/** Flights shorter than this (scene units) get no warp at all: hopping from Earth to the Moon needs none. */
export const WARP_MIN_TRAVEL = 25;
/** Flights at least this long get the full effect. */
export const WARP_FULL_TRAVEL = 150;

/**
 * How strong the warp streaks are, from 0 (none) to 1 (full).
 *   progress: how far through the flight we are, 0 at takeoff to 1 on arrival
 *   travel:   how far the camera's target moves during the flight, in scene units
 *   reducedMotion: the player asked for less movement
 * The effect swells in, peaks in the middle of the flight, and fades out before arrival.
 */
export function warpStrength(progress: number, travel: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0; // fallback: no streaks, the flight is instant anyway
  if (!(progress > 0 && progress < 1)) return 0;
  if (!Number.isFinite(travel)) return 0; // never let a bad number (NaN) leak into an opacity
  const length = Math.min(
    1,
    Math.max(0, (travel - WARP_MIN_TRAVEL) / (WARP_FULL_TRAVEL - WARP_MIN_TRAVEL)),
  );
  return length * Math.sin(progress * Math.PI);
}

/** While piloting the spacecraft, streaks start to show above this speed (scene units per second)... */
export const CRUISE_WARP_START = 12;
/** ...and are at full strength from this speed. */
export const CRUISE_WARP_FULL = 40;

/**
 * How strong the warp streaks are while PILOTING, from 0 to 1. They give a sense of speed in empty space (where
 * nothing else moves past you) and fade in smoothly as you go faster. Reverse and slow flight show none.
 */
export function cruiseWarp(speed: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (!Number.isFinite(speed)) return 0; // never let a bad number (NaN) leak into an opacity
  return Math.min(
    1,
    Math.max(0, (speed - CRUISE_WARP_START) / (CRUISE_WARP_FULL - CRUISE_WARP_START)),
  );
}

/** How many warp streaks to draw at a graphics level (0 = none). */
export function warpStreakCount(enabled: boolean): number {
  return enabled ? 160 : 0;
}

// ---- Atmosphere (a thin glowing haze around a planet's edge) -----------------------------------------

export interface AtmosphereSpec {
  /** Colour of the haze. */
  color: number;
  /** Size of the haze shell as a multiple of the planet's radius (1.1 = 10% bigger). */
  thickness: number;
  /** Brightness, 0 to about 1.5. */
  strength: number;
}

// ---- Can this device do bloom? ------------------------------------------------------------------------

/** What the graphics card reports (from WebGL), reduced to what the bloom decision needs. */
export interface GpuFacts {
  /** Can it draw into a 16-bit floating-point picture? (WebGL extensions EXT_color_buffer_float or _half_float.) */
  canRenderToFloat: boolean;
  /** The most edge-smoothing samples it supports on a hidden picture (0 = none). */
  maxSamples: number;
}

/**
 * Decides whether bloom can safely run, and with how many smoothing samples. Not every phone GPU can draw into a
 * floating-point picture; on one that cannot, the screen would go black, so we skip bloom instead (the game still
 * works, just without the glow). Returns null when bloom must not be used.
 */
export function bloomPlan(
  level: Exclude<BloomLevel, 'off'>,
  gpu: GpuFacts,
): (BloomSettings & { level: Exclude<BloomLevel, 'off'> }) | null {
  if (!gpu.canRenderToFloat) return null;
  const settings = bloomSettings(level);
  return {
    ...settings,
    level,
    msaaSamples: Math.max(0, Math.min(settings.msaaSamples, gpu.maxSamples)),
  };
}

// ---- Testing override: ?effects=off --------------------------------------------------------------------

/**
 * Reads the `?effects=` testing override from a URL query. Only "off" does anything. Automated tests use it so
 * the (software-rendered) 3D stays fast; players never need it. Anything else, including a missing value,
 * leaves the effects to the graphics profile.
 */
export function readEffectsOverride(search: string): 'off' | null {
  return new URLSearchParams(search).get('effects') === 'off' ? 'off' : null;
}

/** The same quality settings with every visual effect switched off (all other settings untouched). */
export function withoutEffects<Q extends { bloom: BloomLevel; atmosphere: boolean; warp: boolean }>(
  quality: Q,
): Q {
  return { ...quality, bloom: 'off', atmosphere: false, warp: false };
}

// The COMPRESSED game scale (spec: "Compressed scale is disclosed").
// Real distances are impossible to show at once: if the Sun were 1 metre wide, Earth would be a
// 1 cm pea about 107 metres away. So the game uses these made-up "scene units" instead.
// The info panel always shows the TRUE values from objects.json; this file is only for looks.

import type { AtmosphereSpec } from './effects';

export interface VisualSpec {
  /** Sphere radius in scene units. */
  radius: number;
  /** Colour used for the sphere (hex). */
  color: number;
  /** Orbit around another object. Omitted for the Sun, which sits at the centre. */
  orbit?: { parentId: string; radius: number };
  /** Name used to find image files in assets/textures (e.g. "moon" finds moon-1k.jpg). Optional. */
  texture?: string;
  /** True if the body always shows the same face to its parent (the Moon does). */
  tidallyLocked?: boolean;
  /**
   * Faint glow (0 to 1) that lets the picture show on the unlit side. For the Moon this stands in for
   * "Earthshine": sunlight bounced off Earth that dimly lights the Moon's night side. Artistic strength.
   */
  nightGlow?: number;
  /**
   * For a textured body that does not spin: which longitude (degrees east) of its map faces the default
   * camera. Without this the side you first see would be whatever the picture's edge happens to be.
   */
  startLongitudeDeg?: number;
  /**
   * Orbit time (in simulated days) used for DRAWING when the real one would be unwatchable. Phobos really
   * circles Mars in 0.32 days, which at the game's speed is about 9 laps every second. The real period is
   * still what the info panel shows. The order of speeds stays true (Phobos fastest, then Deimos, then the
   * Moon), which a unit test checks. This is disclosed in the docs.
   */
  visualPeriodDays?: number;
  /** True if it orbits the OPPOSITE way to everything else (clockwise seen from above north). Triton does. */
  retrograde?: boolean;
  /** A glowing haze around the edge, for worlds with a real atmosphere. Decorative. */
  atmosphere?: AtmosphereSpec;
  /** Rings drawn around the body (Saturn). Sizes are multiples of the body's radius. Decorative. */
  rings?: { inner: number; outer: number; color: number; opacity: number; tiltDeg: number };
}

export const VISUALS: Record<string, VisualSpec> = {
  sun: { radius: 8, color: 0xffc860 },
  // Planets: sizes and orbit distances are squeezed so all fit (see the note at the top of the file).
  // Order of size and distance is kept true: Venus is nearly Earth's size, Mercury and Mars are smaller.
  mercury: { radius: 0.8, color: 0x8c8680, orbit: { parentId: 'sun', radius: 28 } },
  venus: {
    radius: 1.9,
    color: 0xe3c07a,
    orbit: { parentId: 'sun', radius: 43 },
    atmosphere: { color: 0xf4dca0, thickness: 1.16, strength: 1.1 }, // thick, bright cloud deck
  },
  earth: {
    radius: 2,
    color: 0x2f6fd6,
    orbit: { parentId: 'sun', radius: 60 },
    atmosphere: { color: 0x5fa0ff, thickness: 1.14, strength: 1.2 },
  },
  moon: {
    radius: 0.55,
    color: 0xb9b9b9,
    orbit: { parentId: 'earth', radius: 6 },
    texture: 'moon',
    tidallyLocked: true,
    nightGlow: 0.08,
  },
  mars: {
    atmosphere: { color: 0xe0a07a, thickness: 1.08, strength: 0.55 }, // thin air
    radius: 1.1,
    color: 0xc1572f,
    orbit: { parentId: 'sun', radius: 80 },
    texture: 'mars',
    startLongitudeDeg: 70, // Syrtis Major and the Hellas basin
  },
  // Mars's two small moons. Real sizes are tiny next to Mars; here they are just big enough to see.
  phobos: {
    radius: 0.18,
    color: 0x8a7f78,
    orbit: { parentId: 'mars', radius: 2.4 },
    tidallyLocked: true,
    visualPeriodDays: 12,
  },
  deimos: {
    radius: 0.12,
    color: 0xb5a595,
    orbit: { parentId: 'mars', radius: 4 },
    tidallyLocked: true,
    visualPeriodDays: 21,
  },
  // The asteroid belt sits between Mars and Jupiter. Orbit distances are compressed, order kept true.
  vesta: {
    radius: 0.3,
    color: 0x9a948c,
    orbit: { parentId: 'sun', radius: 100 },
    visualPeriodDays: 810, // drawn about 1.6 times faster than real, so it visibly moves
  },
  ceres: {
    radius: 0.35,
    color: 0x7d7a78,
    orbit: { parentId: 'sun', radius: 112 },
    visualPeriodDays: 900, // about 1.9 times faster than real
  },
  // The outer planets (unlock at Navigator). Real distances are 5 to 30 times Earth's; here they are squeezed
  // so the whole system still fits, with the true ORDER kept. Sizes keep the true order too.
  jupiter: {
    radius: 5.5,
    color: 0xc8a27a,
    orbit: { parentId: 'sun', radius: 140 },
    visualPeriodDays: 960, // drawn about 4.5 times faster than real
    atmosphere: { color: 0xe8cfa8, thickness: 1.06, strength: 0.55 },
  },
  saturn: {
    atmosphere: { color: 0xf2e4b8, thickness: 1.06, strength: 0.55 },
    radius: 4.8,
    color: 0xe0cf9b,
    orbit: { parentId: 'sun', radius: 165 },
    visualPeriodDays: 1080, // about 10 times faster than real
    // Saturn's rings really reach from about 1.3 to 2.3 planet radii and are tilted about 27 degrees.
    rings: { inner: 1.3, outer: 2.3, color: 0xcdb98a, opacity: 0.75, tiltDeg: 26.7 },
  },
  uranus: {
    radius: 3.2,
    color: 0x9fd6e0,
    orbit: { parentId: 'sun', radius: 190 },
    visualPeriodDays: 1200, // about 26 times faster than real
    atmosphere: { color: 0xb4f4f8, thickness: 1.1, strength: 0.9 },
  },
  neptune: {
    radius: 3.1,
    color: 0x4a6fe0,
    orbit: { parentId: 'sun', radius: 212 },
    visualPeriodDays: 1320, // about 46 times faster than real
    atmosphere: { color: 0x7fa0ff, thickness: 1.1, strength: 0.9 },
  },
  // Moons of the outer planets. They unlock with their planet. Real laps range from 1.4 to 17 days, a blur at
  // game speed, so each is DRAWN with a slowed period (>= 9 days = 3 s a lap). Order of speed around each planet
  // stays true; a unit test checks it. Sizes keep the true order across ALL bodies (also tested).
  io: {
    radius: 0.57,
    color: 0xd9c36a,
    orbit: { parentId: 'jupiter', radius: 9.5 },
    tidallyLocked: true,
    visualPeriodDays: 9,
  },
  europa: {
    radius: 0.5,
    color: 0xcfc7b5,
    orbit: { parentId: 'jupiter', radius: 12.5 },
    tidallyLocked: true,
    visualPeriodDays: 14,
  },
  ganymede: {
    radius: 0.9,
    color: 0x8d8577,
    orbit: { parentId: 'jupiter', radius: 16 },
    tidallyLocked: true,
    visualPeriodDays: 22,
  },
  callisto: {
    radius: 0.6,
    color: 0x6b6358,
    orbit: { parentId: 'jupiter', radius: 20 },
    tidallyLocked: true,
    visualPeriodDays: 33,
  },
  // Saturn's rings reach 2.3 planet radii (about 11 units), so its moons orbit beyond them.
  enceladus: {
    radius: 0.2,
    color: 0xf2f6f8,
    orbit: { parentId: 'saturn', radius: 14 },
    tidallyLocked: true,
    visualPeriodDays: 10,
  },
  titan: {
    atmosphere: { color: 0xe9a850, thickness: 1.22, strength: 1.0 }, // thick orange haze
    radius: 0.85,
    color: 0xd9a05b,
    orbit: { parentId: 'saturn', radius: 23 },
    tidallyLocked: true,
    visualPeriodDays: 27,
  },
  triton: {
    radius: 0.45,
    color: 0xc9b8b0,
    orbit: { parentId: 'neptune', radius: 7.5 },
    tidallyLocked: true,
    retrograde: true, // Triton circles Neptune backwards
    visualPeriodDays: 15,
  },
  // More moons (outer region). Saturn's mid-sized moons orbit beyond its rings (about 11 units); Uranus gets its five big ones.
  mimas: {
    radius: 0.19,
    color: 0xc9c9c9,
    orbit: { parentId: 'saturn', radius: 12.5 },
    tidallyLocked: true,
    visualPeriodDays: 9,
  },
  tethys: {
    radius: 0.36,
    color: 0xe6e6e6,
    orbit: { parentId: 'saturn', radius: 16.5 },
    tidallyLocked: true,
    visualPeriodDays: 11.5,
  },
  dione: {
    radius: 0.37,
    color: 0xd9d9d9,
    orbit: { parentId: 'saturn', radius: 18.5 },
    tidallyLocked: true,
    visualPeriodDays: 13.5,
  },
  rhea: {
    radius: 0.415,
    color: 0xcfcfcf,
    orbit: { parentId: 'saturn', radius: 20.5 },
    tidallyLocked: true,
    visualPeriodDays: 16.5,
  },
  iapetus: {
    radius: 0.4,
    color: 0xa89f8a,
    orbit: { parentId: 'saturn', radius: 28 },
    tidallyLocked: true,
  },
  miranda: {
    radius: 0.195,
    color: 0xb0b0b8,
    orbit: { parentId: 'uranus', radius: 6.5 },
    tidallyLocked: true,
    visualPeriodDays: 9,
  },
  ariel: {
    radius: 0.375,
    color: 0xc7c7cf,
    orbit: { parentId: 'uranus', radius: 8 },
    tidallyLocked: true,
    visualPeriodDays: 12,
  },
  umbriel: {
    radius: 0.38,
    color: 0x6e6e74,
    orbit: { parentId: 'uranus', radius: 9.5 },
    tidallyLocked: true,
    visualPeriodDays: 16,
  },
  titania: {
    radius: 0.42,
    color: 0xa09c9a,
    orbit: { parentId: 'uranus', radius: 11.5 },
    tidallyLocked: true,
    visualPeriodDays: 24,
  },
  oberon: {
    radius: 0.41,
    color: 0x8d8480,
    orbit: { parentId: 'uranus', radius: 13.5 },
    tidallyLocked: true,
    visualPeriodDays: 33,
  },
};

/**
 * How many simulated days pass per real second. At 3 days per second:
 *   Mercury's year about 29 s, Venus about 75 s, Earth about 2 min, Mars about 3.8 min,
 *   and the Moon circles Earth in about 9 s (it was 2.7 s at 10 days per second, which felt frantic
 *   because the Moon also turns once per orbit to keep its near side facing Earth).
 * One speed for everything keeps the true ratios between orbits. This is a simulation speed, not a
 * measurement, and it is not shown to the player as a real time scale.
 */
export const SIM_DAYS_PER_SECOND = 3;

/** Distance the camera flies to when focusing an object: far enough to see it, close enough to feel big. */
export const focusDistance = (radius: number): number => Math.max(radius * 5, 3);

/** Closest the camera may get to an object: just outside its surface. */
export const closestDistance = (radius: number): number => radius * 1.6 + 0.5;

/** How far away the scanner can still reach an object (twice the focus distance). */
export const scanRange = (radius: number): number => focusDistance(radius) * 2;

/**
 * How far from the Sun the farthest of these bodies can be: its orbit radius plus the orbits of whatever it
 * circles (a moon of Mars adds Mars's orbit). Used to frame the camera and the 2D chart.
 */
export function reachFromSun(ids: Iterable<string>): number {
  const distanceFromSun = (id: string): number => {
    const orbit = VISUALS[id]?.orbit;
    return orbit ? orbit.radius + distanceFromSun(orbit.parentId) : 0;
  };
  return Math.max(0, ...[...ids].map(distanceFromSun));
}

/** Camera distance for the whole-system overview, so the outermost visible orbit just fits. */
export function overviewDistanceFor(reach: number): number {
  return Math.max(OVERVIEW_DISTANCE_MIN, Math.round(reach * OVERVIEW_PER_UNIT_OF_REACH));
}

const OVERVIEW_PER_UNIT_OF_REACH = 2.15;
const OVERVIEW_DISTANCE_MIN = 150;

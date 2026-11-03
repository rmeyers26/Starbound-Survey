// What a comet is made of, as PURE functions (no Three.js, no browser), so they can be unit tested:
//   - the SHAPE of the nucleus: a lumpy, elongated "dirty snowball", not a smooth round moon;
//   - its ICY PATCHES: a dark crust with bright ice showing through;
//   - the BROKEN-UP ROCKS AND ICE: a halo of chunks circling the nucleus and a stream of them trailing into the tail.
// All of it is DECORATIVE (the real nucleus's size and shape are not known, and the game says so), but it is made
// from fixed numbers, so the comet looks the same every time and the tests can check it.
import { clamp, vec, type Vec3 } from './flight';
import { mulberry32 } from './random';

/** The nucleus is never squashed or stretched beyond these multiples of its nominal radius. */
export const NUCLEUS_MIN_SCALE = 0.6;
export const NUCLEUS_MAX_SCALE = 1.5;

// ---- noise: smooth, repeatable "random" numbers that depend on a position ------------------------------------------

/** A repeatable pseudo-random number from 0 up to (not including) 1 for a whole-number grid point. */
function hash(ix: number, iy: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177);
  h ^= Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smooth value noise between -1 and 1: neighbouring points get similar numbers. */
function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const corner = (dx: number, dy: number, dz: number): number =>
    hash(ix + dx, iy + dy, iz + dz, seed);
  const along = (dy: number, dz: number): number => mix(corner(0, dy, dz), corner(1, dy, dz), fx);
  const plane = (dz: number): number => mix(along(0, dz), along(1, dz), fy);
  return mix(plane(0), plane(1), fz) * 2 - 1;
}

/** Lumpiness at a point: big bulges plus smaller bumps plus fine roughness, between -1 and 1. */
export function lumpiness(p: Vec3, seed = 7): number {
  const value =
    0.6 * valueNoise(p.x, p.y, p.z, seed) +
    0.3 * valueNoise(p.x * 2.3 + 11, p.y * 2.3 + 5, p.z * 2.3 + 3, seed + 1) +
    0.1 * valueNoise(p.x * 5.1 + 7, p.y * 5.1 + 2, p.z * 5.1 + 9, seed + 2);
  return clamp(value, -1, 1);
}

// ---- the nucleus ------------------------------------------------------------------------------------------------

/**
 * How far out the surface is in the direction `direction` (a unit vector), as a multiple of the nominal radius.
 * The nucleus is stretched along x (like a peanut or a potato) and lumpy, which is what real comet nuclei look like
 * up close (Halley's, 67P). Always between NUCLEUS_MIN_SCALE and NUCLEUS_MAX_SCALE.
 */
export function nucleusScale(direction: Vec3, seed = 7): number {
  const stretch = 1 + 0.45 * direction.x * direction.x; // longer along x
  const lumps =
    1 + 0.3 * lumpiness({ x: direction.x * 1.6, y: direction.y * 1.6, z: direction.z * 1.6 }, seed);
  return clamp(0.82 * stretch * lumps, NUCLEUS_MIN_SCALE, NUCLEUS_MAX_SCALE);
}

/**
 * How icy a patch of the surface is, from 0 (dark, dusty crust) to 1 (bright, clean ice). Mostly dark with
 * patches of bright ice, because a real nucleus reflects only a few percent of the light on average.
 */
export function iceFraction(direction: Vec3, seed = 7): number {
  const n = lumpiness(
    { x: direction.x * 2.6 + 4, y: direction.y * 2.6 - 3, z: direction.z * 2.6 + 8 },
    seed + 20,
  );
  return smooth(clamp((n - 0.05) / 0.5, 0, 1)); // only the highest patches turn icy
}

// ---- the broken-up rocks and ice -----------------------------------------------------------------------------------

export interface DebrisChunk {
  /** 'halo' chunks circle the nucleus; 'trail' chunks stream away from it along the tail. */
  kind: 'halo' | 'trail';
  /** Halo: starting angle round the nucleus. Trail: the angle round the tail's axis. (radians) */
  angle: number;
  /** Halo: how far above or below its orbit plane (-1 to 1). Trail: unused (0). */
  tilt: number;
  /** Halo: distance from the nucleus, in nucleus radii. Trail: how far from the tail's centre line (0 to 1). */
  distance: number;
  /** Trail: where along the tail it starts (0 at the nucleus, 1 at the far end). Halo: unused (0). */
  start: number;
  /** Halo: radians a second round the nucleus. Trail: tails-lengths a second it drifts outward. */
  speed: number;
  /** Its size as a fraction of the nucleus radius. */
  size: number;
  /** How stretched it is (so no two look alike), 1 = round. */
  stretch: number;
  /** True for a bright chunk of ice, false for a dark piece of rock. */
  icy: boolean;
  /** How fast it tumbles, radians a second. */
  spin: number;
}

/** A fixed set of chunks (the same every time for the same seed). About a third circle the nucleus, the rest trail off. */
export function generateDebris(count: number, seed = 11): DebrisChunk[] {
  const random = mulberry32(seed);
  const between = (low: number, high: number): number => low + (high - low) * random();
  const chunks: DebrisChunk[] = [];
  for (let i = 0; i < count; i++) {
    const halo = random() < 0.35;
    chunks.push({
      kind: halo ? 'halo' : 'trail',
      angle: between(0, Math.PI * 2),
      tilt: halo ? between(-1, 1) : 0,
      distance: halo ? between(1.6, 4.5) : Math.sqrt(random()), // the square root fills a disc evenly
      // More chunks near the head of the tail than at its far end (squaring crowds the numbers toward 0).
      start: halo ? 0 : random() * random(),
      speed: halo ? between(0.25, 0.9) * (random() < 0.5 ? -1 : 1) : between(0.03, 0.09),
      size: halo ? between(0.07, 0.24) : between(0.04, 0.17),
      stretch: between(0.6, 1.8),
      icy: random() < 0.4,
      spin: between(-2, 2),
    });
  }
  return chunks;
}

export interface DebrisPlacement {
  /** Where the chunk is, relative to the nucleus, in the tail's own axes (x and y across the tail, z along it). */
  offset: Vec3;
  /** How big it is right now, in scene units (0 = hidden). */
  size: number;
  /** How far along the tail it is, 0 to 1 (always 0 for a halo chunk). */
  along: number;
}

/**
 * Where a chunk is `seconds` after the start. `nucleusRadius` is the nucleus's nominal radius and `trailLength` how
 * long the debris stream is (0 = no stream, so the trail chunks are hidden but the halo stays).
 */
export function placeDebris(
  chunk: DebrisChunk,
  seconds: number,
  nucleusRadius: number,
  trailLength: number,
): DebrisPlacement {
  const time = Number.isFinite(seconds) ? seconds : 0;
  if (chunk.kind === 'halo') {
    const radius = chunk.distance * nucleusRadius;
    const angle = chunk.angle + chunk.speed * time;
    const flat = Math.sqrt(Math.max(0, 1 - chunk.tilt * chunk.tilt)); // so the distance stays exactly `radius`
    return {
      offset: vec(
        Math.cos(angle) * flat * radius,
        chunk.tilt * radius,
        Math.sin(angle) * flat * radius,
      ),
      size: chunk.size * nucleusRadius,
      along: 0,
    };
  }
  if (!(trailLength > 0.05)) return { offset: vec(0, 0, 0), size: 0, along: 0 };
  // Drifts outward along the tail and starts again at the nucleus, shrinking to nothing as it reaches the far end.
  const along = (((chunk.start + chunk.speed * time) % 1) + 1) % 1;
  const width = mix(nucleusRadius * 1.5, trailLength * 0.14, along) * chunk.distance;
  const angle = chunk.angle + chunk.spin * 0.05 * time;
  return {
    offset: vec(Math.cos(angle) * width, Math.sin(angle) * width, along * trailLength),
    size: chunk.size * nucleusRadius * Math.pow(1 - along, 0.7),
    along,
  };
}

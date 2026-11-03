// The main asteroid belt: thousands of small rocks between Mars and Jupiter.
// It is DECORATIVE (labelled "simulation"): the real belt holds millions of rocks and they are far apart,
// so the dots show where the belt is, not how crowded it is. Ceres and Vesta are the real, scannable members.
import { mulberry32 } from './random';

/** How many rocks are generated (the quality profile then draws only some of them). */
export const MAX_BELT_ROCKS = 3000;
/** Inner and outer edge of the belt in scene units: outside Mars (80), inside Jupiter (140). */
export const BELT_INNER_RADIUS = 96;
export const BELT_OUTER_RADIUS = 124;
/** The belt is a thin disc: rocks sit within this height above or below the orbit plane. */
export const BELT_HALF_THICKNESS = 2.2;
/** Roughly the real average: the belt's rocks take about 4.4 years to go round the Sun. */
export const BELT_PERIOD_DAYS = 1600;

export interface BeltRock {
  /** Distance from the Sun in scene units. */
  radius: number;
  /** Where along the orbit it starts, 0 to 2π radians. */
  angle: number;
  /** Height above (+) or below (-) the orbit plane. */
  height: number;
}

/**
 * Places `count` rocks. The same `seed` always gives the same belt, so it looks identical on every load
 * and in both renderers. Rocks are packed a little more densely toward the middle of the belt.
 */
export function generateBelt(count: number, seed = 4242): BeltRock[] {
  const random = mulberry32(seed);
  const middle = (BELT_INNER_RADIUS + BELT_OUTER_RADIUS) / 2;
  const half = (BELT_OUTER_RADIUS - BELT_INNER_RADIUS) / 2;
  const rocks: BeltRock[] = [];
  for (let i = 0; i < count; i++) {
    // Averaging two random numbers makes values near the centre more likely than the edges.
    const spread = (random() + random() - 1) * half;
    rocks.push({
      radius: middle + spread,
      angle: random() * Math.PI * 2,
      height: (random() * 2 - 1) * BELT_HALF_THICKNESS,
    });
  }
  return rocks;
}

/** How many belt rocks a quality level draws (the same ratio to the star count in both renderers). */
export function beltRockCount(starCount: number): number {
  return Math.min(MAX_BELT_ROCKS, Math.round(starCount * 0.75));
}

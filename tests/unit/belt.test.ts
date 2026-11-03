import { describe, expect, it } from 'vitest';
import {
  BELT_HALF_THICKNESS,
  BELT_INNER_RADIUS,
  BELT_OUTER_RADIUS,
  MAX_BELT_ROCKS,
  beltRockCount,
  generateBelt,
} from '../../src/engine/belt';
import { VISUALS } from '../../src/engine/scale';

describe('asteroid belt', () => {
  const rocks = generateBelt(MAX_BELT_ROCKS);

  it('makes exactly the number of rocks asked for', () => {
    expect(rocks).toHaveLength(MAX_BELT_ROCKS);
    expect(generateBelt(0)).toEqual([]);
  });

  it('is the same belt every time (so it looks identical on every load and in both renderers)', () => {
    expect(generateBelt(50)).toEqual(generateBelt(50));
    expect(generateBelt(50, 1)).not.toEqual(generateBelt(50, 2));
  });

  it('keeps every rock inside the belt: a thin flat disc, with no bad numbers', () => {
    for (const rock of rocks) {
      expect(rock.radius).toBeGreaterThanOrEqual(BELT_INNER_RADIUS);
      expect(rock.radius).toBeLessThanOrEqual(BELT_OUTER_RADIUS);
      expect(Math.abs(rock.height)).toBeLessThanOrEqual(BELT_HALF_THICKNESS);
      expect(rock.angle).toBeGreaterThanOrEqual(0);
      expect(rock.angle).toBeLessThan(Math.PI * 2);
      expect(Number.isFinite(rock.radius + rock.angle + rock.height)).toBe(true);
    }
  });

  it('sits between Mars and Jupiter, and surrounds Vesta and Ceres', () => {
    expect(BELT_INNER_RADIUS).toBeGreaterThan(VISUALS.mars.orbit!.radius);
    expect(BELT_OUTER_RADIUS).toBeLessThan(VISUALS.jupiter.orbit!.radius);
    for (const id of ['vesta', 'ceres']) {
      const radius = VISUALS[id].orbit!.radius;
      expect(radius).toBeGreaterThan(BELT_INNER_RADIUS);
      expect(radius).toBeLessThan(BELT_OUTER_RADIUS);
    }
  });

  it('is denser in the middle than at the edges', () => {
    const middle = (BELT_INNER_RADIUS + BELT_OUTER_RADIUS) / 2;
    const quarter = (BELT_OUTER_RADIUS - BELT_INNER_RADIUS) / 4;
    const central = rocks.filter((r) => Math.abs(r.radius - middle) < quarter).length;
    expect(central).toBeGreaterThan(rocks.length / 2); // half the width should hold more than half the rocks
  });

  it('draws fewer rocks on weaker quality levels, never more than were made', () => {
    expect(beltRockCount(4000)).toBe(3000); // High
    expect(beltRockCount(2000)).toBe(1500); // Balanced
    expect(beltRockCount(800)).toBe(600); // Performance
    expect(beltRockCount(1_000_000)).toBe(MAX_BELT_ROCKS);
  });
});

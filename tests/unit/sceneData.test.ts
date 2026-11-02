// Safety net: the game data (data/objects.json) and the scene table (VISUALS in scale.ts) are two
// separate lists that must agree. If someone adds an object to one and forgets the other, the game
// would crash or silently show nothing. These tests catch that immediately.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIM_DAYS_PER_SECOND, VISUALS } from '../../src/engine/scale';
import { computePositions } from '../../src/engine/solarSystem';
import { textureUrlFor } from '../../src/engine/textures';
import { validateObjects } from '../../src/game/validateObjects';

const objects = validateObjects(JSON.parse(readFileSync('data/objects.json', 'utf8')));

describe('objects.json and the 3D scene agree', () => {
  it('every object in the data has a place in the scene', () => {
    const missing = objects.map((o) => o.id).filter((id) => !VISUALS[id]);
    expect(missing).toEqual([]);
  });

  it('every body in the scene has data (so it can be selected and scanned)', () => {
    const ids = new Set(objects.map((o) => o.id));
    expect(Object.keys(VISUALS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every orbiting body has a numeric orbital period and a real parent', () => {
    for (const [id, spec] of Object.entries(VISUALS)) {
      if (!spec.orbit) continue;
      expect(VISUALS[spec.orbit.parentId], `${id}'s parent`).toBeDefined();
    }
    expect(() => computePositions(objects, 0)).not.toThrow();
  });

  it('planets sit in order of distance from the Sun, as in real life', () => {
    const radius = (id: string): number => VISUALS[id].orbit!.radius;
    expect(radius('mercury')).toBeLessThan(radius('venus'));
    expect(radius('venus')).toBeLessThan(radius('earth'));
    expect(radius('earth')).toBeLessThan(radius('mars'));
  });

  it('the scene orders planets by size the way the data does', () => {
    const size = (id: string): number =>
      objects.find((o) => o.id === id)!.data.diameter.value as number;
    const bySceneSize = ['mercury', 'mars', 'venus', 'earth'].sort(
      (a, b) => VISUALS[a].radius - VISUALS[b].radius,
    );
    const byRealSize = ['mercury', 'mars', 'venus', 'earth'].sort((a, b) => size(a) - size(b));
    expect(bySceneSize).toEqual(byRealSize);
  });

  it('planets are the real way round: nothing overlaps the Sun', () => {
    for (const id of ['mercury', 'venus', 'earth', 'mars']) {
      expect(VISUALS[id].orbit!.radius).toBeGreaterThan(VISUALS.sun.radius + VISUALS[id].radius);
    }
  });

  it('the simulation is slow enough to follow: the Moon takes at least 8 seconds to circle Earth', () => {
    const moonDays = objects.find((o) => o.id === 'moon')!.data.orbitalPeriod.value as number;
    expect(moonDays / SIM_DAYS_PER_SECOND).toBeGreaterThanOrEqual(8);
  });

  it('...but not so slow that Mars feels frozen (its year is under 5 minutes)', () => {
    const marsDays = objects.find((o) => o.id === 'mars')!.data.orbitalPeriod.value as number;
    expect(marsDays / SIM_DAYS_PER_SECOND).toBeLessThan(300);
  });

  it('every body that names a texture has a picture file for it (a typo would silently leave it flat)', () => {
    for (const [id, spec] of Object.entries(VISUALS)) {
      if (!spec.texture) continue;
      expect(textureUrlFor(spec.texture, 1024), `${id} 1k`).not.toBeNull();
      expect(textureUrlFor(spec.texture, 2048), `${id} 2k`).not.toBeNull();
    }
  });
});

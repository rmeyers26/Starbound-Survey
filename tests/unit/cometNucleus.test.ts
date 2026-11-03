// The comet's lumpy nucleus, its icy patches and the broken-up rocks and ice round it and trailing behind it.
import { describe, expect, it } from 'vitest';
import {
  NUCLEUS_MAX_SCALE,
  NUCLEUS_MIN_SCALE,
  generateDebris,
  iceFraction,
  lumpiness,
  nucleusScale,
  placeDebris,
} from '../../src/engine/cometNucleus';
import { length, vec, type Vec3 } from '../../src/engine/flight';
import { mulberry32 } from '../../src/engine/random';

/** A spread of unit directions all round a sphere (the same every run). */
function directions(count: number): Vec3[] {
  const random = mulberry32(99);
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    const t = random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    out.push(vec(Math.cos(t) * r, u, Math.sin(t) * r));
  }
  return out;
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('lumpiness (the noise that makes the nucleus lumpy)', () => {
  it('is the same every time for the same place, and stays between -1 and 1', () => {
    for (const d of directions(200)) {
      const a = lumpiness(d);
      expect(lumpiness(d)).toBe(a);
      expect(a).toBeGreaterThanOrEqual(-1);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('is smooth: two nearby places get nearly the same number (so the surface is lumpy, not spiky)', () => {
    for (const d of directions(100)) {
      const near = vec(d.x + 0.001, d.y, d.z);
      expect(Math.abs(lumpiness(d) - lumpiness(near))).toBeLessThan(0.05);
    }
  });

  it('really varies from place to place, and a different seed gives a different nucleus', () => {
    const values = directions(200).map((d) => lumpiness(d));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.8);
    const other = directions(200).map((d) => lumpiness(d, 8));
    expect(other).not.toEqual(values);
  });
});

describe('the nucleus shape: a lumpy, stretched "dirty snowball", not a smooth moon', () => {
  const scales = directions(600).map((d) => nucleusScale(d));

  it('never goes beyond its limits', () => {
    for (const s of scales) {
      expect(s).toBeGreaterThanOrEqual(NUCLEUS_MIN_SCALE);
      expect(s).toBeLessThanOrEqual(NUCLEUS_MAX_SCALE);
    }
  });

  it('is clearly NOT round: the surface is much further out in some directions than others', () => {
    // A smooth sphere would have every value the same. A comet nucleus is lumpy and elongated.
    expect(Math.max(...scales) / Math.min(...scales)).toBeGreaterThan(1.4);
  });

  it('is stretched along x: the ends are further out than the middle, on average', () => {
    const ends = directions(2000).filter((d) => Math.abs(d.x) > 0.9);
    const middle = directions(2000).filter((d) => Math.abs(d.x) < 0.2);
    expect(ends.length).toBeGreaterThan(20);
    expect(middle.length).toBeGreaterThan(100);
    expect(mean(ends.map((d) => nucleusScale(d)))).toBeGreaterThan(
      mean(middle.map((d) => nucleusScale(d))) * 1.15,
    );
  });

  it('keeps about the nominal radius on average (so its size still means what the scene says)', () => {
    expect(mean(scales)).toBeGreaterThan(0.8);
    expect(mean(scales)).toBeLessThan(1.25);
  });
});

describe('icy patches', () => {
  const ice = directions(800).map((d) => iceFraction(d));

  it('stay between 0 and 1', () => {
    for (const i of ice) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(1);
    }
  });

  it('cover only part of the surface: mostly dark crust with bright ice showing through', () => {
    const icy = ice.filter((i) => i > 0.5).length / ice.length;
    const dark = ice.filter((i) => i < 0.1).length / ice.length;
    expect(icy).toBeGreaterThan(0.05);
    expect(icy).toBeLessThan(0.45);
    expect(dark).toBeGreaterThan(0.4);
  });
});

describe('the broken-up rocks and ice', () => {
  const chunks = generateDebris(140);
  const halo = chunks.filter((c) => c.kind === 'halo');
  const trail = chunks.filter((c) => c.kind === 'trail');

  it('makes exactly the number asked for, the same every time, and different for another seed', () => {
    expect(chunks).toHaveLength(140);
    expect(generateDebris(140)).toEqual(chunks);
    expect(generateDebris(140, 12)).not.toEqual(chunks);
    expect(generateDebris(0)).toEqual([]);
  });

  it('has both a halo round the nucleus and a stream trailing behind it (about a third and two thirds)', () => {
    expect(halo.length).toBeGreaterThan(25);
    expect(trail.length).toBeGreaterThan(65);
  });

  it('has both bright ice and dark rock, in different sizes and shapes (no two alike)', () => {
    const icy = chunks.filter((c) => c.icy).length / chunks.length;
    expect(icy).toBeGreaterThan(0.2);
    expect(icy).toBeLessThan(0.6);
    expect(new Set(chunks.map((c) => c.size.toFixed(3))).size).toBeGreaterThan(90);
    expect(Math.max(...chunks.map((c) => c.stretch))).toBeGreaterThan(1.4);
    expect(Math.min(...chunks.map((c) => c.stretch))).toBeLessThan(0.9);
  });

  it('crowds more chunks near the nucleus than at the far end of the tail', () => {
    const near = trail.filter((c) => c.start < 0.25).length;
    const far = trail.filter((c) => c.start > 0.75).length;
    expect(near).toBeGreaterThan(far * 2);
  });

  it('keeps a halo chunk at exactly its distance from the nucleus as it circles, at any time', () => {
    for (const chunk of halo) {
      for (const t of [0, 1.7, 13.2, 500]) {
        const place = placeDebris(chunk, t, 0.3, 10);
        expect(length(place.offset), `chunk at ${t}s`).toBeCloseTo(chunk.distance * 0.3, 9);
        expect(place.size).toBeGreaterThan(0);
      }
    }
  });

  it('really circles: a halo chunk is somewhere else a moment later', () => {
    const chunk = halo[0];
    const a = placeDebris(chunk, 0, 0.3, 10).offset;
    const b = placeDebris(chunk, 1, 0.3, 10).offset;
    expect(length(vec(a.x - b.x, a.y - b.y, a.z - b.z))).toBeGreaterThan(0.01);
  });

  it('streams trail chunks outward along the tail, never past its end, shrinking to nothing at the far end', () => {
    for (const chunk of trail) {
      for (const t of [0, 3, 9.1, 40]) {
        const place = placeDebris(chunk, t, 0.3, 10);
        expect(place.offset.z).toBeGreaterThanOrEqual(0);
        expect(place.offset.z).toBeLessThanOrEqual(10);
        expect(place.along).toBeGreaterThanOrEqual(0);
        expect(place.along).toBeLessThan(1);
        expect(place.size).toBeGreaterThanOrEqual(0);
      }
    }
    // Find a moment when one is near the far end: it is tiny there, and bigger near the head.
    const chunk = trail[0];
    const nearHead = placeDebris({ ...chunk, start: 0.02, speed: 0 }, 0, 0.3, 10);
    const nearEnd = placeDebris({ ...chunk, start: 0.98, speed: 0 }, 0, 0.3, 10);
    expect(nearEnd.size).toBeLessThan(nearHead.size * 0.3);
  });

  it('spreads the stream out as it goes (narrow at the head, wider further along)', () => {
    const chunk = { ...trail[0], distance: 1, angle: 0, spin: 0, speed: 0 };
    const head = placeDebris({ ...chunk, start: 0.05 }, 0, 0.3, 10).offset;
    const end = placeDebris({ ...chunk, start: 0.9 }, 0, 0.3, 10).offset;
    expect(Math.hypot(end.x, end.y)).toBeGreaterThan(Math.hypot(head.x, head.y));
  });

  it('hides the trail (but keeps the halo) when there is no tail, and survives a nonsense time', () => {
    expect(placeDebris(trail[0], 5, 0.3, 0).size).toBe(0);
    expect(placeDebris(halo[0], 5, 0.3, 0).size).toBeGreaterThan(0);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = placeDebris(trail[0], bad, 0.3, 10);
      expect(Number.isFinite(p.offset.x + p.offset.y + p.offset.z + p.size)).toBe(true);
    }
  });
});

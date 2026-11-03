// The comet maths. These tests check the orbit against the laws of physics (Kepler's equation, energy, the tilt of the
// orbit), not just "it returns numbers", because a wrong comet orbit would look plausible and still be wrong.
import { describe, expect, it } from 'vitest';
import {
  AU_SCENE_STOPS,
  GAUSS_K,
  REPLAY_FADE_FRACTION,
  TAIL_MAX_LENGTH,
  TAIL_START_AU,
  auToScene,
  checkElements,
  cometPath,
  cometScenePosition,
  daysToReachDistance,
  orbitState,
  periodYears,
  replayAt,
  replayLoopDays,
  semiMajorAxisAu,
  solveKepler,
  tailLength,
  type CometElements,
} from '../../src/engine/comet';
import { distance, length, vec, type Vec3 } from '../../src/engine/flight';
import { VISUALS } from '../../src/engine/scale';

/** The verified shape of C/2026 A2 (Bok), with the two unverified angles at the game's display placeholders. */
const BOK: CometElements = {
  perihelionAu: 1.94,
  eccentricity: 0.99761492,
  inclinationDeg: 82,
  nodeDeg: 0,
  argPerihelionDeg: 0,
};

describe("Kepler's equation", () => {
  it('is solved exactly: E - e sin E = M, for gentle and for extreme orbits', () => {
    for (const e of [0, 0.1, 0.5, 0.9, 0.99, 0.99761492, 0.999999]) {
      for (const m of [-3.1, -1, -0.01, -1e-6, 0, 1e-6, 0.01, 1, 3.1, 7, -9]) {
        const E = solveKepler(m, e);
        const turn = Math.PI * 2;
        const wrapped = m - turn * Math.round(m / turn);
        expect(E - e * Math.sin(E) - wrapped, `e=${e} M=${m}`).toBeCloseTo(0, 10);
      }
    }
  });

  it('gives E = 0 when M = 0 (at perihelion) and does not produce NaN for nonsense', () => {
    expect(solveKepler(0, 0.9976)).toBe(0);
    expect(solveKepler(Number.NaN, 0.9)).toBe(0);
    expect(solveKepler(Number.POSITIVE_INFINITY, 0.9)).toBe(0);
  });
});

describe('the orbit of C/2026 A2 (Bok)', () => {
  it('has the shape its numbers say: a long axis of hundreds of AU and a period of many thousand years', () => {
    expect(semiMajorAxisAu(BOK)).toBeCloseTo(1.94 / (1 - 0.99761492), 6);
    expect(semiMajorAxisAu(BOK)).toBeGreaterThan(800);
    expect(semiMajorAxisAu(BOK)).toBeLessThan(830);
    expect(periodYears(BOK)).toBeGreaterThan(22_000);
    expect(periodYears(BOK)).toBeLessThan(24_500);
  });

  it('is exactly at its perihelion distance at t = 0, and never closer to the Sun than that', () => {
    expect(orbitState(BOK, 0).rAu).toBeCloseTo(1.94, 9);
    for (let t = -2000; t <= 2000; t += 25) {
      expect(orbitState(BOK, t).rAu, `day ${t}`).toBeGreaterThanOrEqual(1.94 - 1e-9);
    }
  });

  it('is symmetric: the same distance the same number of days before and after perihelion', () => {
    for (const t of [10, 100, 400, 1500]) {
      expect(orbitState(BOK, t).rAu).toBeCloseTo(orbitState(BOK, -t).rAu, 9);
    }
  });

  it('gets further from the Sun the longer after perihelion (it is leaving), slowly at first', () => {
    let last = 0;
    for (let t = 0; t <= 3000; t += 100) {
      const r = orbitState(BOK, t).rAu;
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it('obeys conservation of energy (the vis-viva equation) at several points', () => {
    // v^2 = GM (2/r - 1/a). In AU and days, GM = k^2. Speed is measured from two nearby positions.
    const a = semiMajorAxisAu(BOK);
    for (const t of [-300, -50, 0, 20, 150, 600]) {
      const dt = 0.01;
      const before = orbitState(BOK, t - dt);
      const after = orbitState(BOK, t + dt);
      const speed = distance(after.eclipticAu, before.eclipticAu) / (2 * dt);
      const r = orbitState(BOK, t).rAu;
      const expected = Math.sqrt(GAUSS_K * GAUSS_K * (2 / r - 1 / a));
      expect(speed / expected, `day ${t}`).toBeCloseTo(1, 4);
    }
  });

  it('moves fastest at perihelion: about 6.4 AU a year (30 km/s) at 1.94 AU', () => {
    const dt = 0.01;
    const speedAu =
      distance(orbitState(BOK, dt).eclipticAu, orbitState(BOK, -dt).eclipticAu) / (2 * dt);
    expect(speedAu * 365.25).toBeGreaterThan(6.2);
    expect(speedAu * 365.25).toBeLessThan(6.6);
  });

  it("is tilted by its inclination: the orbit's axis makes that angle with the planets' plane", () => {
    // The axis is the cross product of two position vectors (r1 x r2) in the orbit.
    const r1 = orbitState(BOK, 30).eclipticAu;
    const r2 = orbitState(BOK, 120).eclipticAu;
    const axis: Vec3 = vec(
      r1.y * r2.z - r1.z * r2.y,
      r1.z * r2.x - r1.x * r2.z,
      r1.x * r2.y - r1.y * r2.x,
    );
    const tilt = Math.acos(axis.z / length(axis)) * (180 / Math.PI);
    expect(tilt).toBeCloseTo(82, 4);
  });

  it('goes round the same way as the planets (82 degrees is less than 90): counter-clockwise from above north', () => {
    const at = (t: number) => cometScenePosition(BOK, t);
    // At perihelion (node 0, argument 0) it is on the +x axis. The planets then head toward -z.
    expect(at(0).x).toBeGreaterThan(0);
    expect(Math.abs(at(0).z)).toBeLessThan(1e-9);
    expect(at(2).z).toBeLessThan(0);
    expect(at(-2).z).toBeGreaterThan(0);
  });

  it("rises out of the planets' plane because of the tilt, and passes through it at perihelion (argument 0)", () => {
    expect(Math.abs(cometScenePosition(BOK, 0).y)).toBeLessThan(1e-9);
    expect(Math.abs(cometScenePosition(BOK, 200).y)).toBeGreaterThan(5);
    // North of the plane after the crossing, south of it before (it climbs from south to north).
    expect(cometScenePosition(BOK, 200).y).toBeGreaterThan(0);
    expect(cometScenePosition(BOK, -200).y).toBeLessThan(0);
  });

  it('a different node or argument turns the whole orbit but keeps its size and shape', () => {
    const turned = { ...BOK, nodeDeg: 123, argPerihelionDeg: 77 };
    for (const t of [-400, -10, 0, 90, 500]) {
      expect(orbitState(turned, t).rAu).toBeCloseTo(orbitState(BOK, t).rAu, 9);
    }
    // But the position differs (it points a different way).
    expect(
      distance(orbitState(turned, 90).eclipticAu, orbitState(BOK, 90).eclipticAu),
    ).toBeGreaterThan(0.1);
  });
});

describe('checking the numbers', () => {
  it('refuses orbits that are not closed ellipses or make no sense', () => {
    expect(() => checkElements(BOK)).not.toThrow();
    expect(() => checkElements({ ...BOK, eccentricity: 1 })).toThrow(RangeError);
    expect(() => checkElements({ ...BOK, eccentricity: 1.3 })).toThrow(RangeError);
    expect(() => checkElements({ ...BOK, eccentricity: 0 })).toThrow(RangeError);
    expect(() => checkElements({ ...BOK, perihelionAu: 0 })).toThrow(RangeError);
    expect(() => checkElements({ ...BOK, perihelionAu: -2 })).toThrow(RangeError);
    expect(() => checkElements({ ...BOK, inclinationDeg: Number.NaN })).toThrow(RangeError);
    expect(() => orbitState({ ...BOK, eccentricity: 1 }, 5)).toThrow(RangeError);
  });
});

describe("the game's compressed distance scale", () => {
  it("matches the game's planets exactly, so a comet at Earth's distance is drawn where Earth is", () => {
    const planets: Array<[number, string]> = [
      [0.387, 'mercury'],
      [0.723, 'venus'],
      [1.0, 'earth'],
      [1.524, 'mars'],
      [2.77, 'ceres'],
      [5.204, 'jupiter'],
      [9.583, 'saturn'],
      [19.2, 'uranus'],
      [30.07, 'neptune'],
    ];
    for (const [au, id] of planets) {
      expect(auToScene(au), id).toBeCloseTo(VISUALS[id].orbit!.radius, 6);
    }
  });

  it('always rises with distance, even past Neptune, and zero stays zero', () => {
    expect(auToScene(0)).toBe(0);
    let last = -1;
    for (let au = 0; au <= 900; au += 0.37) {
      const scene = auToScene(au);
      expect(scene, `${au} AU`).toBeGreaterThan(last);
      last = scene;
    }
    expect(AU_SCENE_STOPS.length).toBeGreaterThan(5);
  });

  it('gives 0 for nonsense instead of NaN', () => {
    for (const bad of [Number.NaN, -3, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(auToScene(bad)).toBe(0);
    }
  });

  it("draws the comet's perihelion between Mars and Ceres, at its scene position", () => {
    const perihelion = cometScenePosition(BOK, 0);
    expect(length(perihelion)).toBeGreaterThan(VISUALS.mars.orbit!.radius);
    expect(length(perihelion)).toBeLessThan(VISUALS.ceres.orbit!.radius);
  });
});

describe('the replay', () => {
  const WINDOW = 3.5;

  it('shows the stretch of the flyby inside the window, which takes a few hundred days of game time', () => {
    const half = daysToReachDistance(BOK, WINDOW);
    expect(half).toBeGreaterThan(100);
    expect(half).toBeLessThan(400);
    // At the edge of the window the comet really is WINDOW AU from the Sun.
    expect(orbitState(BOK, half).rAu).toBeCloseTo(WINDOW, 6);
    expect(orbitState(BOK, -half).rAu).toBeCloseTo(WINDOW, 6);
    expect(replayLoopDays(BOK, WINDOW)).toBeCloseTo(2 * half, 9);
  });

  it('starts on the way in, reaches perihelion half way round the loop, and ends on the way out', () => {
    const loop = replayLoopDays(BOK, WINDOW);
    expect(replayAt(BOK, WINDOW, 0).daysSincePerihelion).toBeCloseTo(-loop / 2, 6);
    expect(replayAt(BOK, WINDOW, loop / 2).daysSincePerihelion).toBeCloseTo(0, 6);
    expect(replayAt(BOK, WINDOW, loop - 0.001).daysSincePerihelion).toBeCloseTo(loop / 2, 2);
  });

  it('repeats: the same moment every loop, including before time zero', () => {
    const loop = replayLoopDays(BOK, WINDOW);
    for (const t of [5, 77, 200]) {
      expect(replayAt(BOK, WINDOW, t + 3 * loop).daysSincePerihelion).toBeCloseTo(
        replayAt(BOK, WINDOW, t).daysSincePerihelion,
        4,
      );
      expect(replayAt(BOK, WINDOW, t - loop).daysSincePerihelion).toBeCloseTo(
        replayAt(BOK, WINDOW, t).daysSincePerihelion,
        4,
      );
    }
  });

  it('fades in at the start, is fully visible in the middle, and fades out at the end (the jump back is never seen)', () => {
    const loop = replayLoopDays(BOK, WINDOW);
    expect(replayAt(BOK, WINDOW, 0).fade).toBe(0);
    expect(replayAt(BOK, WINDOW, loop / 2).fade).toBe(1);
    expect(replayAt(BOK, WINDOW, loop * REPLAY_FADE_FRACTION).fade).toBeCloseTo(1, 6);
    expect(replayAt(BOK, WINDOW, loop - 0.0001).fade).toBeLessThan(0.001);
    for (let t = 0; t < loop; t += loop / 200) {
      const { fade } = replayAt(BOK, WINDOW, t);
      expect(fade).toBeGreaterThanOrEqual(0);
      expect(fade).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the REAL speeds: fastest at perihelion, and about 35% slower at the edge of the window (3.5 AU)', () => {
    // Real speed in AU per day, from two moments one day apart. (Vis-viva: v = k * sqrt(2/r - 1/a).)
    const speedAt = (days: number) =>
      distance(orbitState(BOK, days + 0.5).eclipticAu, orbitState(BOK, days - 0.5).eclipticAu);
    const half = daysToReachDistance(BOK, WINDOW);
    const nearEdge = speedAt(half - 1);
    const atPerihelion = speedAt(0);
    expect(atPerihelion).toBeGreaterThan(nearEdge);
    expect(atPerihelion / nearEdge).toBeGreaterThan(1.25);
    expect(atPerihelion / nearEdge).toBeLessThan(1.5);
    // And the replay plays that real motion at the game's clock, one simulated day per simulated day.
    const loop = replayLoopDays(BOK, WINDOW);
    const a = cometScenePosition(BOK, replayAt(BOK, WINDOW, loop / 2).daysSincePerihelion);
    const b = cometScenePosition(BOK, replayAt(BOK, WINDOW, loop / 2 + 1).daysSincePerihelion);
    expect(distance(a, b)).toBeGreaterThan(0.5); // it really moves each game day at perihelion
  });

  it('copes with nonsense times (NaN, infinite) without NaN', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const moment = replayAt(BOK, WINDOW, bad);
      expect(Number.isFinite(moment.daysSincePerihelion)).toBe(true);
      expect(Number.isFinite(moment.fade)).toBe(true);
    }
  });

  it('refuses a window that is closer than perihelion or further than aphelion', () => {
    expect(() => replayAt(BOK, 1.0, 5)).toThrow(RangeError);
    expect(() => replayAt(BOK, 5000, 5)).toThrow(RangeError);
  });
});

describe('the tail', () => {
  it('is zero when far from the Sun, longest at perihelion, and grows smoothly as it nears the Sun', () => {
    expect(tailLength(10, 1.94)).toBe(0);
    expect(tailLength(TAIL_START_AU, 1.94)).toBe(0);
    expect(tailLength(1.94, 1.94)).toBeCloseTo(TAIL_MAX_LENGTH);
    let last = Infinity;
    for (let r = 1.94; r <= 3.3; r += 0.05) {
      const length = tailLength(r, 1.94);
      expect(length).toBeLessThanOrEqual(last + 1e-9);
      last = length;
    }
  });

  it('is never negative or bigger than the maximum, and survives nonsense', () => {
    for (const r of [0, 0.5, 1.94, 2.5, 3.1, 3.2, 50, Number.NaN, Number.POSITIVE_INFINITY]) {
      const length = tailLength(r, 1.94);
      expect(length).toBeGreaterThanOrEqual(0);
      expect(length).toBeLessThanOrEqual(TAIL_MAX_LENGTH);
    }
    expect(tailLength(2, Number.NaN)).toBe(0);
  });
});

describe('the path drawn as a line', () => {
  it('has the requested number of points, joined smoothly, from the way in to the way out', () => {
    const path = cometPath(BOK, 3.5, 120);
    expect(path).toHaveLength(120);
    // The ends are at the edge of the window (3.5 AU), mapped to the scene.
    expect(length(path[0])).toBeCloseTo(auToScene(3.5), 3);
    expect(length(path[119])).toBeCloseTo(auToScene(3.5), 3);
    let longest = 0;
    for (let i = 1; i < path.length; i++)
      longest = Math.max(longest, distance(path[i], path[i - 1]));
    expect(longest).toBeLessThan(8); // no big gaps, so the line looks like a curve and not a few straight pieces
  });
});

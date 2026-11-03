// Comet maths: where a comet is on its long, stretched-out orbit, how it is replayed in the game, and how long its
// tail is. PURE functions (no Three.js, no browser), so every rule can be unit tested.
//
// Why comets need their own maths: planets and moons here go round in circles at a steady speed. A comet's orbit is a
// very long ellipse. It moves fastest at perihelion (closest approach to the Sun, and much slower hundreds of AU out), and it is
// tilted to the planets' flat plane (an inclination), so it needs a height as well as a position on the flat plane.
//
// What is real and what is not (the game's "honest science" rule):
//   - REAL: the orbit's shape and tilt (perihelion distance q, eccentricity e, inclination i) come from the data file.
//     The speed follows Kepler's laws: fastest at perihelion (about 30 km/s here), a little slower at the edges of the
//     part we replay (which stops at 3.5 AU), and very slow indeed hundreds of AU away (which the game never shows).
//   - NOT REAL: the two angles that say which way the orbit points (node and argument of perihelion) are display
//     placeholders until they are checked (see VisualSpec.comet). And the comet is REPLAYED on a loop, because the real
//     one passes the Sun once and does not come back for thousands of years.
//   - NOT REAL: distances use the game's compressed scale (auToScene), like the planets.
import { clamp, vec, type Vec3 } from './flight';

/** The Gaussian gravitational constant: how fast (radians per day) something 1 AU from the Sun goes round it. */
export const GAUSS_K = 0.01720209895;

/** The orbit's shape and orientation. Distances in AU, angles in degrees. */
export interface CometElements {
  /** Perihelion distance: the closest the comet gets to the Sun. */
  perihelionAu: number;
  /** Eccentricity: 0 is a circle; just below 1 is an extremely long, thin ellipse. */
  eccentricity: number;
  /** Tilt of the orbit against the planets' flat plane. Under 90 means it goes round the same way the planets do. */
  inclinationDeg: number;
  /** Longitude of the ascending node: where the orbit crosses the planets' plane going north. */
  nodeDeg: number;
  /** Argument of perihelion: where, along the orbit measured from that crossing, the closest point lies. */
  argPerihelionDeg: number;
}

const RAD = Math.PI / 180;

/** Throws if the numbers cannot describe a (closed) comet orbit. */
export function checkElements(el: CometElements): void {
  const finite = [
    el.perihelionAu,
    el.eccentricity,
    el.inclinationDeg,
    el.nodeDeg,
    el.argPerihelionDeg,
  ].every((n) => Number.isFinite(n));
  if (!finite) throw new RangeError('comet elements must all be finite numbers');
  if (!(el.perihelionAu > 0)) throw new RangeError('perihelion distance must be above 0');
  if (!(el.eccentricity > 0 && el.eccentricity < 1)) {
    throw new RangeError('eccentricity must be between 0 and 1 (a closed orbit)');
  }
}

/** Half the long axis of the ellipse, in AU. Huge for a comet like this one (hundreds of AU). */
export const semiMajorAxisAu = (el: CometElements): number =>
  el.perihelionAu / (1 - el.eccentricity);

/** How long one full trip round the orbit takes, in years (Kepler's third law). Very uncertain for a comet. */
export const periodYears = (el: CometElements): number => Math.pow(semiMajorAxisAu(el), 1.5);

/** Radians per day the comet's "mean anomaly" (its clock round the orbit) advances. */
const meanMotion = (el: CometElements): number => GAUSS_K / Math.pow(semiMajorAxisAu(el), 1.5);

/**
 * Solves Kepler's equation  E - e sin E = M  for E (the "eccentric anomaly"), given M (the clock) and e.
 * f(E) = E - e sin E - M only ever goes up, so we can always narrow in on the answer: Newton's method (fast) with a
 * halving step as a safety net whenever Newton would jump outside the range that is known to hold the answer.
 */
export function solveKepler(meanAnomaly: number, e: number): number {
  if (!Number.isFinite(meanAnomaly)) return 0;
  // Wrap M into -PI..PI (the orbit repeats every 2 PI).
  const turn = Math.PI * 2;
  const m = meanAnomaly - turn * Math.round(meanAnomaly / turn);
  let low = -Math.PI;
  let high = Math.PI;
  let guess = e > 0.8 ? Math.sign(m) * Math.min(Math.PI, Math.cbrt(6 * Math.abs(m))) : m;
  for (let step = 0; step < 100; step++) {
    const f = guess - e * Math.sin(guess) - m;
    if (f === 0) return guess; // already exactly right (for example M = 0, the comet at perihelion)
    if (f > 0) high = guess;
    else low = guess;
    const slope = 1 - e * Math.cos(guess);
    let next = guess - f / slope;
    if (!(next > low && next < high)) next = (low + high) / 2; // Newton left the safe range: halve instead
    if (Math.abs(next - guess) < 1e-14) return next;
    guess = next;
  }
  return guess;
}

export interface OrbitState {
  /** Distance from the Sun in AU. */
  rAu: number;
  /** True anomaly: the angle from perihelion, as seen from the Sun, in radians. */
  trueAnomaly: number;
  /** Position in AU in the sky's usual axes: X toward the spring equinox, Y a quarter turn on, Z toward north. */
  eclipticAu: Vec3;
}

/** Where the comet is `daysSincePerihelion` days after its closest approach (negative = before it). */
export function orbitState(el: CometElements, daysSincePerihelion: number): OrbitState {
  checkElements(el);
  const e = el.eccentricity;
  const a = semiMajorAxisAu(el);
  const E = solveKepler(meanMotion(el) * daysSincePerihelion, e);
  const trueAnomaly =
    2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const rAu = a * (1 - e * Math.cos(E));

  // Turn a position in the orbit's own plane into the sky's axes: spin by the argument of perihelion, tilt by the
  // inclination, then turn by the node. (The standard orbital-elements recipe.)
  const u = el.argPerihelionDeg * RAD + trueAnomaly;
  const node = el.nodeDeg * RAD;
  const tilt = el.inclinationDeg * RAD;
  const eclipticAu = vec(
    rAu * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(tilt)),
    rAu * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(tilt)),
    rAu * Math.sin(u) * Math.sin(tilt),
  );
  return { rAu, trueAnomaly, eclipticAu };
}

// ---- the game's compressed distance scale -------------------------------------------------------------------------

/**
 * Pairs of (real distance from the Sun in AU, how far out the game draws it in scene units). These are the planets'
 * mean distances and their orbit radii in the game (scale.ts; a test checks they agree). A comet at 2 AU is drawn
 * between Mars and Ceres, exactly like a planet would be. Between the pairs the scale is a straight line.
 */
export const AU_SCENE_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.387, 28], // Mercury
  [0.723, 43], // Venus
  [1.0, 60], // Earth
  [1.524, 80], // Mars
  [2.77, 112], // Ceres
  [5.204, 140], // Jupiter
  [9.583, 165], // Saturn
  [19.2, 190], // Uranus
  [30.07, 212], // Neptune
];

/** Real distance from the Sun (AU) to the game's compressed scene distance. Always rising, and 0 stays 0. */
export function auToScene(au: number): number {
  if (!Number.isFinite(au) || au <= 0) return 0;
  const stops = AU_SCENE_STOPS;
  for (let i = 1; i < stops.length; i++) {
    const [auHigh, sceneHigh] = stops[i];
    if (au <= auHigh) {
      const [auLow, sceneLow] = stops[i - 1];
      return sceneLow + ((au - auLow) / (auHigh - auLow)) * (sceneHigh - sceneLow);
    }
  }
  // Beyond Neptune: keep going, but more slowly, so even a far-out comet stays at a finite distance.
  const [auLast, sceneLast] = stops[stops.length - 1];
  return sceneLast + (au - auLast) * 0.4;
}

/**
 * The comet's position in the game's scene (x east-ish, y UP toward north, z so that planets go counter-clockwise),
 * for `daysSincePerihelion`. The direction is true; only the distance is compressed.
 */
export function cometScenePosition(el: CometElements, daysSincePerihelion: number): Vec3 {
  return sceneFromOrbitState(orbitState(el, daysSincePerihelion));
}

/** The same, from an orbit state you already have (so the maths is not done twice). */
export function sceneFromOrbitState({ rAu, eclipticAu }: OrbitState): Vec3 {
  const k = rAu > 0 ? auToScene(rAu) / rAu : 0;
  // Sky axes -> game axes: game x = X, game y (up) = Z, game z = -Y. (The same flip the planets' z = -sin uses, so
  // a comet that goes round the same way as the planets goes counter-clockwise seen from above north.)
  return vec(eclipticAu.x * k, eclipticAu.z * k, -eclipticAu.y * k);
}

// ---- the replay -------------------------------------------------------------------------------------------------

/**
 * Days after perihelion at which the comet is `rAu` from the Sun on its way OUT (the same number of days before
 * perihelion on its way in). Used to find how long the stretch of the flyby we show takes.
 */
export function daysToReachDistance(el: CometElements, rAu: number): number {
  checkElements(el);
  const a = semiMajorAxisAu(el);
  const e = el.eccentricity;
  const aphelion = a * (1 + e);
  if (!(rAu >= el.perihelionAu && rAu <= aphelion)) {
    throw new RangeError(
      `distance must be between perihelion (${el.perihelionAu} AU) and aphelion`,
    );
  }
  const cosE = clamp((1 - rAu / a) / e, -1, 1);
  const E = Math.acos(cosE);
  return (E - e * Math.sin(E)) / meanMotion(el);
}

/** How much of each end of the replay the comet fades in or out over (a fraction of the loop). */
export const REPLAY_FADE_FRACTION = 0.08;

export interface ReplayMoment {
  /** Days since perihelion (negative = still on the way in). */
  daysSincePerihelion: number;
  /** 0 (invisible, at the very start or end of the loop) to 1 (fully visible). */
  fade: number;
  /** Where in the loop we are, 0 to 1. */
  loopProgress: number;
}

/**
 * The comet is shown only while it is within `windowAu` of the Sun. That stretch of its real flyby is replayed on a
 * loop at the game's own clock, so the speeds keep their real proportions (fastest at perihelion). It fades
 * in at the start and out at the end, so the jump back to the start is never seen.
 */
export function replayAt(el: CometElements, windowAu: number, simDays: number): ReplayMoment {
  const half = daysToReachDistance(el, windowAu);
  const loop = 2 * half;
  const days = Number.isFinite(simDays) ? simDays : 0;
  const phase = ((days % loop) + loop) % loop;
  const edge = loop * REPLAY_FADE_FRACTION;
  const fadeIn = clamp(phase / edge, 0, 1);
  const fadeOut = clamp((loop - phase) / edge, 0, 1);
  return {
    daysSincePerihelion: phase - half,
    fade: Math.min(fadeIn, fadeOut),
    loopProgress: phase / loop,
  };
}

/** How long one loop of the replay lasts in simulated days (the comet is shown going in, round the Sun, and out). */
export const replayLoopDays = (el: CometElements, windowAu: number): number =>
  2 * daysToReachDistance(el, windowAu);

// ---- the tail ---------------------------------------------------------------------------------------------------

/** A comet only grows a tail once it is warm enough for its ice to turn to gas, roughly inside this distance. */
export const TAIL_START_AU = 3.2;
/** The longest the tail is drawn, in scene units (at perihelion). Decorative: real tails can be millions of km. */
export const TAIL_MAX_LENGTH = 14;

/**
 * How long to draw the tail (scene units) when the comet is `rAu` from the Sun: none beyond TAIL_START_AU, and
 * growing smoothly to TAIL_MAX_LENGTH at perihelion `perihelionAu`. DECORATIVE: the real length depends on the comet's
 * activity, which the game does not know. A tail always points AWAY from the Sun (the solar wind and sunlight push it).
 */
export function tailLength(rAu: number, perihelionAu: number): number {
  if (!Number.isFinite(rAu) || !Number.isFinite(perihelionAu)) return 0;
  if (rAu >= TAIL_START_AU || TAIL_START_AU <= perihelionAu) return 0;
  const warmth = clamp((TAIL_START_AU - rAu) / (TAIL_START_AU - perihelionAu), 0, 1);
  return TAIL_MAX_LENGTH * warmth * warmth; // grows slowly at first, then quickly as it nears the Sun
}

// ---- the path ---------------------------------------------------------------------------------------------------

/** Points along the part of the orbit shown in the game, evenly spaced in time, from the way in to the way out. */
export function cometPath(el: CometElements, windowAu: number, points = 96): Vec3[] {
  const half = daysToReachDistance(el, windowAu);
  const path: Vec3[] = [];
  for (let i = 0; i < points; i++) {
    path.push(cometScenePosition(el, -half + (2 * half * i) / (points - 1)));
  }
  return path;
}

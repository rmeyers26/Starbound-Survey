// The spacecraft's DESIGN as plain numbers, with no Three.js, so the proportions can be unit tested and the camera
// distances (which are tuned for a ship this size) cannot drift unnoticed.
//
// Coordinates: the nose points toward -Z (yaw 0, see flight.ts), +X is the ship's right, +Y is up. About 0.7 scene
// units long. Silhouette: a slim fuselage with a pointed nose and canopy, swept delta wings with winglets, a tail fin,
// twin engines, a gold thermal-foil service ring, solar arrays on booms, and an antenna dish.

/** Overall size limits (scene units). The camera views are framed for a ship about this big. */
export const SHIP_LENGTH = 0.72;
export const SHIP_SPAN = 0.8; // wingtip to wingtip, including the solar arrays
export const SHIP_HEIGHT = 0.36; // the bottom of the hull to the top of the antenna dish (the fin is a little lower)

/** Where the nose and the tail are along Z. */
export const NOSE_Z = -0.4;
export const TAIL_Z = 0.32;

export interface ProfilePoint {
  /** Distance from the ship's centre line. */
  radius: number;
  /** Distance along the ship toward the NOSE (positive = toward the nose), so a lathe turns it round the Y axis. */
  along: number;
}

/**
 * The fuselage as a profile to spin round its centre line: from the engine end (tail) to the point of the nose.
 * Built from a smooth curve so the surface has no creases: a slim engine bay, the widest part just behind the
 * middle, then a long, graceful ogive (a curved point, like a bullet) to the nose.
 */
export function hullProfile(samples = 40): ProfilePoint[] {
  const tail = -TAIL_Z;
  const nose = -NOSE_Z;
  const widest = 0.14;
  const widestAt = -0.1;
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const along = tail + (nose - tail) * t;
    let radius: number;
    if (along <= widestAt) {
      // From the engine bay out to the widest part: a smooth swell (a quarter of a sine wave).
      const u = (along - tail) / (widestAt - tail);
      radius = 0.095 + (widest - 0.095) * Math.sin((u * Math.PI) / 2);
    } else {
      // From the widest part to the nose: an ogive. Slowly narrowing at first, then curving to a point.
      const u = (along - widestAt) / (nose - widestAt);
      radius = widest * Math.pow(Math.max(0, 1 - u * u), 0.75);
    }
    points.push({ radius, along });
  }
  return points;
}

/** The outline of one wing, seen from above, as [x, z] points (right wing; mirror it for the left). A swept delta. */
export function wingOutline(): Array<[number, number]> {
  return [
    [0.1, -0.12], // root, front (where the wing meets the fuselage)
    [0.34, 0.1], // tip, front
    [0.34, 0.18], // tip, back
    [0.1, 0.2], // root, back
  ];
}

/**
 * The outline of the tail fin, seen from the side, as [z, y] points (y measured up from the ship's centre line).
 * Swept back. The root is sunk into the hull, and the top stands well above it.
 */
export function finOutline(): Array<[number, number]> {
  return [
    [0.06, 0.05], // root, front (inside the hull)
    [0.24, 0.22], // top, front
    [0.31, 0.22], // top, back
    [0.31, 0.04], // root, back (inside the hull)
  ];
}

/** How far from the centre line the hull's surface is at `along` (positive = toward the nose). Used to put details on it. */
export function hullRadiusAt(along: number, samples = 80): number {
  const profile = hullProfile(samples);
  if (
    !Number.isFinite(along) ||
    along <= profile[0].along ||
    along >= profile[profile.length - 1].along
  ) {
    return along <= profile[0].along && Number.isFinite(along) ? profile[0].radius : 0;
  }
  for (let i = 1; i < profile.length; i++) {
    if (along <= profile[i].along) {
      const a = profile[i - 1];
      const b = profile[i];
      const t = (along - a.along) / (b.along - a.along);
      return a.radius + (b.radius - a.radius) * t;
    }
  }
  return 0;
}

/** An engine bell as a profile to spin: narrow at the throat, flaring out to the exit. */
export function bellProfile(samples = 12): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    points.push({
      radius: 0.026 + 0.034 * Math.pow(t, 0.6), // flares fast near the throat, then straightens: a "bell"
      along: -t * 0.08, // runs backward from the throat
    });
  }
  return points;
}

/** A dish antenna as a profile to spin: a shallow parabola. */
export function dishProfile(samples = 10, radius = 0.05, depth = 0.014): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const r = (i / samples) * radius;
    points.push({ radius: r, along: depth * Math.pow(r / radius, 2) }); // depth grows with the square: a parabola
  }
  return points;
}

/** The ship's lights: where each is and what colour (aviation style: red on the left, green on the right, white behind). */
export const NAVIGATION_LIGHTS = [
  { name: 'port', position: [-0.34, 0, 0.16] as const, color: 0xff2a2a, period: 1.6 },
  { name: 'starboard', position: [0.34, 0, 0.16] as const, color: 0x2aff5a, period: 1.6 },
  { name: 'tail', position: [0, 0.215, 0.3] as const, color: 0xffffff, period: 0.9 },
];

/** How bright a blinking light is at `seconds` (0 to 1): a short bright flash, then dark, like a real strobe. */
export function blink(seconds: number, period: number): number {
  if (!Number.isFinite(seconds) || !(period > 0)) return 0;
  const phase = (((seconds / period) % 1) + 1) % 1;
  return phase < 0.18 ? 1 : 0.12; // on for the first 18% of each period, a faint glow the rest of the time
}

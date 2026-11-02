// The COMPRESSED game scale (spec: "Compressed scale is disclosed").
// Real distances are impossible to show at once: if the Sun were 1 metre wide, Earth would be a
// 1 cm pea about 107 metres away. So the game uses these made-up "scene units" instead.
// The info panel always shows the TRUE values from objects.json; this file is only for looks.

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
}

export const VISUALS: Record<string, VisualSpec> = {
  sun: { radius: 8, color: 0xffc860 },
  // Planets: sizes and orbit distances are squeezed so all fit (see the note at the top of the file).
  // Order of size and distance is kept true: Venus is nearly Earth's size, Mercury and Mars are smaller.
  mercury: { radius: 0.8, color: 0x8c8680, orbit: { parentId: 'sun', radius: 28 } },
  venus: { radius: 1.9, color: 0xe3c07a, orbit: { parentId: 'sun', radius: 43 } },
  earth: { radius: 2, color: 0x2f6fd6, orbit: { parentId: 'sun', radius: 60 } },
  moon: {
    radius: 0.55,
    color: 0xb9b9b9,
    orbit: { parentId: 'earth', radius: 6 },
    texture: 'moon',
    tidallyLocked: true,
    nightGlow: 0.08,
  },
  mars: { radius: 1.1, color: 0xc1572f, orbit: { parentId: 'sun', radius: 80 } },
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

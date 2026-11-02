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
}

export const VISUALS: Record<string, VisualSpec> = {
  sun: { radius: 8, color: 0xffc860 },
  earth: { radius: 2, color: 0x2f6fd6, orbit: { parentId: 'sun', radius: 60 } },
  moon: { radius: 0.55, color: 0xb9b9b9, orbit: { parentId: 'earth', radius: 6 } },
};

/**
 * How many simulated days pass per real second. Earth's year then takes about 36 s
 * (365.256 / 10), and the Moon circles Earth in about 2.7 s: fast enough to see, slow enough
 * to follow. This is a simulation speed, not a measurement.
 */
export const SIM_DAYS_PER_SECOND = 10;

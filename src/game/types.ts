// Shared data shapes for the game. TypeScript checks these at build time,
// so a typo in code (e.g. obj.nmae) is caught before the game runs.

// Where each visual comes from (spec pillar: "Honest science").
export const IMAGE_TYPES = ['observation', 'artistConcept', 'simulation'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

// A body's layers, such as the Sun's core, radiative zone and corona (or later Earth's crust, mantle and core).
// 'interior' layers are inside the body; 'atmosphere' layers are the air or gas around it.
export const LAYER_ZONES = ['interior', 'atmosphere'] as const;
export type LayerZone = (typeof LAYER_ZONES)[number];

export interface Layer {
  id: string; // unique within its object, e.g. "core"
  name: string; // display name, e.g. "The Core"
  zone: LayerZone;
  /** The short description (NASA's wording where we have it). */
  summary: string;
  /** Extra sentences for people who want more detail (marked in docs where it comes from general knowledge). */
  detail?: string;
  /** Which scan reveals it; omitted means 'basic'. Deeper layers need deeper scans. */
  tier?: ScanTier;
  /** Where the band is drawn in the cutaway picture, as fractions of the picture's radius (0 = centre, 1 = edge). */
  ring: [number, number];
  /** Colour of the band in the picture, as "#rrggbb". */
  color: string;
}

// What kind of object this is.
export const OBJECT_TYPES = [
  'star',
  'planet',
  'dwarfPlanet',
  'moon',
  'asteroid',
  'nebula',
  'galaxy',
  'blackHole',
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

// Scanning reveals data in layers (spec: "Layered results"). Higher tiers need a higher scanner level.
export const SCAN_TIERS = ['basic', 'detailed', 'spectral'] as const;
export type ScanTier = (typeof SCAN_TIERS)[number];

// One measurement, e.g. { label: "Diameter", value: 12742, unit: "km" }.
// Keeping the unit next to the number means the UI never has to guess it.
export interface Measurement {
  label: string;
  value: number | string;
  unit?: string; // optional: some values (e.g. "G2V") have no unit
  tier?: ScanTier; // which scan reveals it; omitted means 'basic'
}

export interface CelestialObject {
  id: string; // unique key, e.g. "mars"
  name: string; // display name
  type: ObjectType;
  imageType: ImageType;
  region: string; // which region unlocks it
  quick: string; // beginner summary (Quick facts tab)
  data: Record<string, Measurement>; // real measurements (Advanced data tab)
  source: string; // where the measurements come from
  /** The structure of the body from the inside out (Layers tab). Optional: only some objects have it. */
  layers?: Layer[];
  /** Where the layer descriptions come from (shown under the Layers tab). */
  layersSource?: string;
}

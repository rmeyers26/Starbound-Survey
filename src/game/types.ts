// Shared data shapes for the game. TypeScript checks these at build time,
// so a typo in code (e.g. obj.nmae) is caught before the game runs.

// Where each visual comes from (spec pillar: "Honest science").
export const IMAGE_TYPES = ['observation', 'artistConcept', 'simulation'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

// What kind of object this is.
export const OBJECT_TYPES = ['star', 'planet', 'moon', 'nebula', 'galaxy', 'blackHole'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

// One measurement, e.g. { label: "Diameter", value: 12742, unit: "km" }.
// Keeping the unit next to the number means the UI never has to guess it.
export interface Measurement {
  label: string;
  value: number | string;
  unit?: string; // optional: some values (e.g. "G2V") have no unit
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
}

// Checks raw JSON (type `unknown` = "could be anything") and turns it into trusted,
// typed CelestialObject values. If anything is wrong it throws ONE error listing ALL problems.
import {
  IMAGE_TYPES,
  OBJECT_TYPES,
  SCAN_TIERS,
  LAYER_ZONES,
  type LayerZone,
  type ScanTier,
  type CelestialObject,
  type ImageType,
  type ObjectType,
} from './types';

export class DataValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(
      `Data validation failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}`,
    );
    this.name = 'DataValidationError';
    this.problems = problems;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function checkMeasurement(where: string, raw: unknown, problems: string[]): void {
  if (!isRecord(raw)) {
    problems.push(`${where}: must be an object with label and value`);
    return;
  }
  if (!isNonEmptyString(raw.label)) problems.push(`${where}.label: must be a non-empty string`);
  const v = raw.value;
  const okNumber = typeof v === 'number' && Number.isFinite(v);
  if (!okNumber && !isNonEmptyString(v)) {
    problems.push(`${where}.value: must be a finite number or non-empty string`);
  }
  if (raw.unit !== undefined && !isNonEmptyString(raw.unit)) {
    problems.push(`${where}.unit: if present, must be a non-empty string`);
  }
  if (raw.tier !== undefined && !SCAN_TIERS.includes(raw.tier as ScanTier)) {
    problems.push(`${where}.tier: if present, must be one of ${SCAN_TIERS.join(', ')}`);
  }
}

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

/** Checks one object's optional list of layers (the Sun's core, corona and so on). */
function checkLayers(where: string, raw: unknown, problems: string[]): void {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push(`${where}: if present, must be a non-empty list`);
    return;
  }
  const seen = new Set<string>();
  raw.forEach((layer, i) => {
    const at = `${where}[${i}]`;
    if (!isRecord(layer)) {
      problems.push(`${at}: must be an object`);
      return;
    }
    for (const field of ['id', 'name', 'summary'] as const) {
      if (!isNonEmptyString(layer[field]))
        problems.push(`${at}.${field}: must be a non-empty string`);
    }
    if (isNonEmptyString(layer.id)) {
      if (seen.has(layer.id)) problems.push(`${at}.id: duplicate "${layer.id}"`);
      seen.add(layer.id);
    }
    if (layer.detail !== undefined && !isNonEmptyString(layer.detail)) {
      problems.push(`${at}.detail: if present, must be a non-empty string`);
    }
    if (!LAYER_ZONES.includes(layer.zone as LayerZone)) {
      problems.push(`${at}.zone: must be one of ${LAYER_ZONES.join(', ')}`);
    }
    if (layer.tier !== undefined && !SCAN_TIERS.includes(layer.tier as ScanTier)) {
      problems.push(`${at}.tier: if present, must be one of ${SCAN_TIERS.join(', ')}`);
    }
    const ring = layer.ring;
    const okRing =
      Array.isArray(ring) &&
      ring.length === 2 &&
      ring.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
      ring[0] >= 0 &&
      ring[1] <= 1 &&
      ring[0] < ring[1];
    if (!okRing)
      problems.push(`${at}.ring: must be two numbers [inner, outer] with 0 <= inner < outer <= 1`);
    if (typeof layer.color !== 'string' || !HEX_COLOUR.test(layer.color)) {
      problems.push(`${at}.color: must look like "#ff8800"`);
    }
  });
}

export function validateObjects(raw: unknown): CelestialObject[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) throw new DataValidationError(['Top level must be an array of objects']);

  const seenIds = new Set<string>();
  raw.forEach((item, i) => {
    // Use the id in messages when we have one; it is easier to find than "#3".
    const label = isRecord(item) && isNonEmptyString(item.id) ? `"${item.id}"` : `#${i}`;
    if (!isRecord(item)) {
      problems.push(`Entry ${label}: must be an object`);
      return;
    }
    for (const field of ['id', 'name', 'region', 'quick', 'source'] as const) {
      if (!isNonEmptyString(item[field]))
        problems.push(`Entry ${label}: "${field}" must be a non-empty string`);
    }
    if (isNonEmptyString(item.id)) {
      if (seenIds.has(item.id)) problems.push(`Entry ${label}: duplicate id`);
      seenIds.add(item.id);
    }
    if (!OBJECT_TYPES.includes(item.type as ObjectType)) {
      problems.push(`Entry ${label}: "type" must be one of ${OBJECT_TYPES.join(', ')}`);
    }
    if (!IMAGE_TYPES.includes(item.imageType as ImageType)) {
      problems.push(`Entry ${label}: "imageType" must be one of ${IMAGE_TYPES.join(', ')}`);
    }
    if (item.layers !== undefined) checkLayers(`Entry ${label}: layers`, item.layers, problems);
    if (item.layersSource !== undefined && !isNonEmptyString(item.layersSource)) {
      problems.push(`Entry ${label}: "layersSource" must be a non-empty string`);
    }
    if (item.layers !== undefined && item.layersSource === undefined) {
      problems.push(`Entry ${label}: layers need a "layersSource" saying where they come from`);
    }
    if (!isRecord(item.data)) {
      problems.push(`Entry ${label}: "data" must be an object of measurements`);
    } else {
      for (const [key, m] of Object.entries(item.data)) {
        checkMeasurement(`Entry ${label}: data.${key}`, m, problems);
      }
    }
  });

  if (problems.length > 0) throw new DataValidationError(problems);
  // Safe cast: every field was checked above.
  return raw as CelestialObject[];
}

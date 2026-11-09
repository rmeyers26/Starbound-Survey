// Loads and validates game data. The fetch function is a parameter so tests can fake it.
import { log } from '../engine/log';
import type { CelestialObject } from './types';
import type { Mission } from './missions';
import { validateMissions } from './validateMissions';
import { validateObjects } from './validateObjects';

export class DataLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataLoadError';
  }
}

export async function loadObjects(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<CelestialObject[]> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (cause) {
    // Network down, offline, blocked, etc.
    throw new DataLoadError(`Could not reach ${url}`, { cause });
  }
  if (!response.ok) throw new DataLoadError(`Loading ${url} failed (HTTP ${response.status})`);

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new DataLoadError(`${url} is not valid JSON`, { cause });
  }

  const objects = validateObjects(json); // throws DataValidationError if the content is wrong
  log(`Loaded ${objects.length} objects`);
  return objects;
}

/**
 * Loads the missions. They are checked against the objects (an objective must name a real, reachable object), so
 * load the objects first. If the missions cannot be loaded the game still works: you just have no missions.
 */
export async function loadMissions(
  url: string,
  objects: CelestialObject[],
  fetchFn: typeof fetch = fetch,
): Promise<Mission[]> {
  const response = await fetchFn(url);
  if (!response.ok) throw new DataLoadError(`Loading ${url} failed (HTTP ${response.status})`);
  const missions = validateMissions(await response.json(), objects);
  log(`Loaded ${missions.length} missions`);
  return missions;
}

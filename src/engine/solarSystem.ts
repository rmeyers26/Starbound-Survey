// Where every body is at a given simulated time. Shared by the 3D and the 2D renderer so they
// always agree. Pure maths: periods come from the JSON data, orbit radii from the visual scale.
import type { CelestialObject } from '../game/types';
import { orbitPosition } from './orbits';
import { VISUALS } from './scale';

export interface BodyPosition {
  x: number;
  z: number;
}

/** The orbital period (days) stored in the JSON data. Throws if it is missing. */
export function periodDaysOf(objects: CelestialObject[], id: string): number {
  const object = objects.find((o) => o.id === id);
  const value = object?.data.orbitalPeriod?.value;
  if (typeof value !== 'number') throw new Error(`"${id}" has no numeric orbitalPeriod in data`);
  return value;
}

/** Positions of every body in VISUALS after `simDays` simulated days. */
export function computePositions(
  objects: CelestialObject[],
  simDays: number,
): Map<string, BodyPosition> {
  const positions = new Map<string, BodyPosition>();

  const resolve = (id: string): BodyPosition => {
    const known = positions.get(id);
    if (known) return known;
    const orbit = VISUALS[id]?.orbit;
    let position: BodyPosition;
    if (!orbit) {
      position = { x: 0, z: 0 }; // the Sun sits at the centre
    } else {
      const parent = resolve(orbit.parentId); // a body's position is its parent's + its orbit offset
      // Fast moons use a slowed display period so they can be seen (see VisualSpec.visualPeriodDays).
      const period = VISUALS[id].visualPeriodDays ?? periodDaysOf(objects, id);
      const offset = orbitPosition(orbit.radius, period, simDays);
      position = { x: parent.x + offset.x, z: parent.z + offset.z };
    }
    positions.set(id, position);
    return position;
  };

  for (const id of Object.keys(VISUALS)) resolve(id);
  return positions;
}

// Where every body is at a given simulated time. Shared by the 3D and the 2D renderer so they
// always agree. Pure maths: periods come from the JSON data, orbit radii from the visual scale.
import type { CelestialObject } from '../game/types';
import { orbitState, replayAt, sceneFromOrbitState, type CometElements } from './comet';
import { orbitPosition } from './orbits';
import { VISUALS } from './scale';

export interface BodyPosition {
  x: number;
  z: number;
  /** Height above the planets' flat plane. Only a comet has one (its orbit is tilted); everything else is flat (0). */
  y?: number;
  /** 0 to 1: how visible the body is. Only a replayed comet fades (in and out at the ends of its loop). */
  fade?: number;
}

/** The "golden angle" in degrees. Stepping round a circle by this much never lands near an earlier step. */
const GOLDEN_ANGLE_DEG = 137.50776;

/**
 * Where on its orbit a body starts, in radians (0 = the side facing away from what it orbits).
 * A body with its own `startAngleDeg` in the scene table uses that. Any other (the moons) starts a golden angle
 * further round than the previous moon of the same planet, so the moons of one planet are spread out and not lined up.
 * This is a display choice, not the real position on any date.
 */
export function startAngleOf(id: string): number {
  const own = VISUALS[id]?.startAngleDeg;
  if (own !== undefined) return (own * Math.PI) / 180;
  const parentId = VISUALS[id]?.orbit?.parentId;
  if (!parentId) return 0;
  const siblings = Object.keys(VISUALS).filter(
    (other) => VISUALS[other].orbit?.parentId === parentId,
  );
  const place = siblings.indexOf(id) + 1; // 1, 2, 3...: the first moon is not at 0, which is every planet's reference side
  const parentStart = VISUALS[parentId]?.startAngleDeg ?? 0; // so two planets' moon families do not start parallel
  return (((parentStart + place * GOLDEN_ANGLE_DEG) % 360) * Math.PI) / 180;
}

/** The orbital period (days) stored in the JSON data. Throws if it is missing. */
export function periodDaysOf(objects: CelestialObject[], id: string): number {
  const object = objects.find((o) => o.id === id);
  const value = object?.data.orbitalPeriod?.value;
  if (typeof value !== 'number') throw new Error(`"${id}" has no numeric orbitalPeriod in data`);
  return value;
}

/**
 * A comet's orbit: the shape from the data file (verified numbers), the two angles from the scene table (display
 * placeholders, see VisualSpec.comet). Throws, naming the missing number, if the data lacks one.
 */
export function cometElementsOf(objects: CelestialObject[], id: string): CometElements {
  const spec = VISUALS[id]?.comet;
  if (!spec) throw new Error(`"${id}" is not a comet in the scene table`);
  const read = (key: string): number => {
    const value = objects.find((o) => o.id === id)?.data[key]?.value;
    if (typeof value !== 'number') throw new Error(`"${id}" has no numeric ${key} in data`);
    return value;
  };
  return {
    perihelionAu: read('perihelionDistance'),
    eccentricity: read('eccentricity'),
    inclinationDeg: read('inclination'),
    nodeDeg: spec.nodeDeg,
    argPerihelionDeg: spec.argPerihelionDeg,
  };
}

/** Where a comet is, how visible it is (fading at the ends of its replay), and how far from the Sun in AU. */
export function cometMoment(
  objects: CelestialObject[],
  id: string,
  simDays: number,
): { x: number; y: number; z: number; fade: number; rAu: number } {
  const elements = cometElementsOf(objects, id);
  const { daysSincePerihelion, fade } = replayAt(elements, VISUALS[id].comet!.windowAu, simDays);
  const state = orbitState(elements, daysSincePerihelion);
  return { ...sceneFromOrbitState(state), fade, rAu: state.rAu };
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
    if (VISUALS[id]?.comet) {
      // A comet is not on a circle: replay its real flyby (with a height, because its orbit is tilted).
      const { x, y, z, fade } = cometMoment(objects, id, simDays);
      position = { x, y, z, fade };
    } else if (!orbit) {
      position = { x: 0, z: 0 }; // the Sun sits at the centre
    } else {
      const parent = resolve(orbit.parentId); // a body's position is its parent's + its orbit offset
      // Fast moons use a slowed display period so they can be seen (see VisualSpec.visualPeriodDays).
      const period = VISUALS[id].visualPeriodDays ?? periodDaysOf(objects, id);
      const offset = orbitPosition(
        orbit.radius,
        period,
        simDays,
        VISUALS[id].retrograde,
        startAngleOf(id),
      );
      position = { x: parent.x + offset.x, z: parent.z + offset.z };
    }
    positions.set(id, position);
    return position;
  };

  for (const id of Object.keys(VISUALS)) resolve(id);
  return positions;
}

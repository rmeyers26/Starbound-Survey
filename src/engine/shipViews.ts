// The ways to look at the spacecraft, as PURE functions (no Three.js), so they can be unit tested.
//
//   chase   - behind and a little above the ship, looking ahead (the default; easiest to steer by)
//   cockpit - from the ship's nose, as if you were the pilot (the ship itself is hidden)
//   orbit   - drag to swing round the ship, zoom in and out (handled by the same CameraRig as the normal camera)
//   map     - straight down from above with the ship's heading pointing up the screen (a navigation chart)
//   cinematic - a self-directing film camera that cuts between flattering shots of the ship (see cinematic.ts)

import { cinematicPose } from './cinematic';
import { forwardVector, vec, type ShipState, type Vec3 } from './flight';

export const SHIP_VIEWS = ['chase', 'cockpit', 'orbit', 'map', 'cinematic'] as const;
export type ShipView = (typeof SHIP_VIEWS)[number];

/** Names shown on the buttons and read out by screen readers. */
export const SHIP_VIEW_LABELS: Record<ShipView, string> = {
  chase: 'Chase',
  cockpit: 'Cockpit',
  orbit: 'Orbit',
  map: 'Map',
  cinematic: 'Cinematic',
};

/** The normal lens angle, in degrees. The cinematic view uses a narrower one. */
export const DEFAULT_FOV = 50;

export function isShipView(value: unknown): value is ShipView {
  return typeof value === 'string' && (SHIP_VIEWS as readonly string[]).includes(value);
}

/** The view after `view` in the list, wrapping round (the V key cycles through them). */
export function nextShipView(view: ShipView): ShipView {
  return SHIP_VIEWS[(SHIP_VIEWS.indexOf(view) + 1) % SHIP_VIEWS.length];
}

// Distances in scene units. The ship is about 0.6 units long, so these frame it comfortably.
export const CHASE_BACK = 2.6;
export const CHASE_UP = 0.9;
export const LOOK_AHEAD = 8;
export const COCKPIT_FORWARD = 0.25;
export const MAP_HEIGHT = 100; // sees about 90 units across: several planets' orbits at once
/** How far the Zoom buttons may scale the chase and map views. */
export const MIN_VIEW_SCALE = 0.4;
export const MAX_VIEW_SCALE = 6;

/** Where a camera should be, what it looks at, and which way is "up" on the screen. */
export interface CameraPose {
  position: Vec3;
  lookAt: Vec3;
  up: Vec3;
  /** The lens angle in degrees. Left out = the normal lens (DEFAULT_FOV). */
  fov?: number;
}

const WORLD_UP = vec(0, 1, 0);
const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
const scaled = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);

/**
 * The pose for the views that do not use the orbit camera. `viewScale` 1 is the default zoom (chase and map).
 * `elapsed` (seconds in the cinematic view) and `reducedMotion` only matter for the cinematic view.
 */
export function cameraPoseFor(
  view: Exclude<ShipView, 'orbit'>,
  ship: Pick<ShipState, 'position' | 'yaw' | 'pitch'>,
  viewScale = 1,
  elapsed = 0,
  reducedMotion = false,
): CameraPose {
  const forward = forwardVector(ship.yaw, ship.pitch);
  const zoom = Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, viewScale));
  switch (view) {
    case 'chase':
      return {
        position: add(
          ship.position,
          add(scaled(forward, -CHASE_BACK * zoom), scaled(WORLD_UP, CHASE_UP * zoom)),
        ),
        lookAt: add(ship.position, scaled(forward, LOOK_AHEAD)),
        up: WORLD_UP,
      };
    case 'cinematic':
      return cinematicPose(ship, elapsed, reducedMotion);
    case 'cockpit':
      return {
        position: add(ship.position, scaled(forward, COCKPIT_FORWARD)),
        lookAt: add(ship.position, scaled(forward, LOOK_AHEAD)),
        up: WORLD_UP,
      };
    case 'map': {
      // Looking straight down, with the ship's heading (flattened onto the flat plane of the Solar System) as "up".
      const heading = vec(forward.x, 0, forward.z);
      const flat = Math.hypot(heading.x, heading.z);
      return {
        position: add(ship.position, vec(0, MAP_HEIGHT * zoom, 0)),
        lookAt: ship.position,
        up: flat < 1e-6 ? vec(0, 0, -1) : scaled(heading, 1 / flat),
      };
    }
  }
}

/**
 * How much to enlarge the ship's model so you can still find it. At map height the real-size ship would be a
 * speck, so the model grows with the camera's distance (never smaller than life-size). Decorative only.
 */
export function shipModelScale(view: ShipView, cameraDistance: number): number {
  if (view === 'cockpit') return 1;
  if (!Number.isFinite(cameraDistance)) return 1;
  return Math.max(1, cameraDistance / 12);
}

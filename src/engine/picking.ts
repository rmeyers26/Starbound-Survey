// Decides which object a tap/click is on. Phones have fat fingers and the Moon is tiny on screen,
// so each object gets a hit area that is never smaller than ~1.8 degrees of view (about 44px).
import * as THREE from 'three';

export interface PickCandidate {
  id: string;
  center: THREE.Vector3;
  radius: number;
}

/** Smallest hit-circle radius as an angle seen from the camera (radians). */
export const MIN_HIT_ANGLE = 0.032;

/** Hit radius in scene units for an object `distance` away from the camera. */
export function hitRadius(objectRadius: number, distance: number): number {
  return Math.max(objectRadius, distance * Math.tan(MIN_HIT_ANGLE));
}

/**
 * Returns the id of the object the ray passes closest to (measured relative to each hit area),
 * or null when it hits nothing. Using "closest to centre" instead of "first hit" gives the
 * sensible answer when two hit areas overlap, such as Earth and the Moon seen from far away.
 */
export function pickObject(
  ray: THREE.Ray,
  cameraPosition: THREE.Vector3,
  candidates: PickCandidate[],
): string | null {
  let best: { id: string; score: number } | null = null;
  const closest = new THREE.Vector3();
  for (const c of candidates) {
    const distance = cameraPosition.distanceTo(c.center);
    const radius = hitRadius(c.radius, distance);
    ray.closestPointToPoint(c.center, closest);
    const miss = closest.distanceTo(c.center);
    if (miss > radius) continue;
    const score = miss / radius; // 0 = dead centre, 1 = edge of the hit area
    if (!best || score < best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

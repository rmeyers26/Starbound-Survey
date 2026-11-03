// The spacecraft's 3D model, built from simple shapes (no model files to download).
// The nose points toward -Z, the same direction as yaw 0 (see flight.ts). It is about 0.6 scene units long.
import * as THREE from 'three';

export interface ShipModel {
  /** Add this to the scene; move and turn it to follow the ship. */
  group: THREE.Group;
  /** The engine flame grows with the throttle (0 = off). */
  setThrottle(throttle: number): void;
}

export function createShipModel(): ShipModel {
  const group = new THREE.Group();
  group.name = 'spacecraft';

  // Pale metal, plus a faint glow of its own so the side facing away from the Sun is not pure black.
  const hull = new THREE.MeshStandardMaterial({
    color: 0x9aa7c0,
    metalness: 0.35,
    roughness: 0.55,
    emissive: 0x28345a, // a faint fill, so the side facing away from the Sun still shows its shape
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xff7a45,
    metalness: 0.2,
    roughness: 0.6,
    emissive: 0x57270f,
  });

  // Body: a cone turned so its point faces -Z.
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.62, 16), hull);
  body.rotation.x = -Math.PI / 2;
  group.add(body);

  // Engine nozzle: a dark ring at the back, so the rear is not a flat white disc when seen from behind.
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.09, 14),
    new THREE.MeshStandardMaterial({ color: 0x2b3142, metalness: 0.6, roughness: 0.4 }),
  );
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0, 0.3);
  group.add(nozzle);

  // Wings and a tail fin.
  const wings = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.025, 0.22), accent);
  wings.position.set(0, 0, 0.12);
  group.add(wings);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.18), accent);
  fin.position.set(0, 0.09, 0.2);
  group.add(fin);

  // Cockpit window.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x7fd4ff, emissive: 0x2a6a9a, roughness: 0.2 }),
  );
  canopy.position.set(0, 0.07, -0.08);
  canopy.scale.set(1, 0.8, 1.6);
  group.add(canopy);

  // Engine flame: a glowing cone pointing backwards, inside a holder we can stretch along Z.
  const flame = new THREE.Group();
  flame.position.set(0, 0, 0.33);
  const flameMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.34, 12),
    new THREE.MeshBasicMaterial({
      color: 0x7fd4ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flameMesh.rotation.x = Math.PI / 2; // point backwards (+Z)
  flameMesh.position.z = 0.17;
  flame.add(flameMesh);
  group.add(flame);

  return {
    group,
    setThrottle(throttle: number): void {
      const power = Math.abs(throttle);
      flame.visible = power > 0.02;
      flame.scale.set(1, 1, 0.4 + power * 1.8);
    },
  };
}

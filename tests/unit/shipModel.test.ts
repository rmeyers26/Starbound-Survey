// The 3D spacecraft, built for real (Three.js runs without a browser; only the drawn textures are replaced by flat
// ones). These tests keep it the size the cameras are framed for, pointing the right way, within a polygon budget a
// phone can draw, and make sure its flames and lights respond.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createShipModel } from '../../src/engine/shipModel';
import { SHIP_HEIGHT, SHIP_LENGTH, SHIP_SPAN } from '../../src/engine/shipDesign';

/** How many triangles a mesh draws (counting every copy of an instanced mesh). */
function triangles(mesh: THREE.Mesh): number {
  const index = mesh.geometry.getIndex();
  const perCopy = (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
  return perCopy * (mesh instanceof THREE.InstancedMesh ? mesh.count : 1);
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) found.push(node);
  });
  return found;
}

/** The flames: the cone-shaped, glowing meshes (the lights' halos are spheres). */
const flames = (root: THREE.Object3D): THREE.Mesh[] =>
  meshes(root).filter((m) => m.geometry instanceof THREE.ConeGeometry);

/** The bulbs of the navigation lights: small plain-colour spheres. */
const bulbs = (root: THREE.Object3D): THREE.Mesh[] =>
  meshes(root).filter(
    (m) =>
      m.geometry instanceof THREE.SphereGeometry && m.material instanceof THREE.MeshBasicMaterial,
  );

describe('the spacecraft model: size and shape', () => {
  const ship = createShipModel();
  const box = new THREE.Box3().setFromObject(ship.group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  it('is about the size the cameras are framed for (a little longer than the hull, for the engine bells)', () => {
    expect(size.z).toBeGreaterThan(SHIP_LENGTH * 0.95);
    expect(size.z).toBeLessThan(SHIP_LENGTH + 0.12);
    expect(size.x).toBeGreaterThan(SHIP_SPAN * 0.8);
    expect(size.x).toBeLessThan(SHIP_SPAN + 0.02);
    expect(size.y).toBeGreaterThan(SHIP_HEIGHT * 0.9);
    expect(size.y).toBeLessThan(SHIP_HEIGHT + 0.03);
  });

  it('points its nose toward -Z (the way yaw 0 faces) and its engines toward +Z', () => {
    expect(box.min.z).toBeGreaterThan(-0.45);
    expect(box.min.z).toBeLessThan(-0.38); // the nose
    expect(box.max.z).toBeGreaterThan(0.33); // the engines
    // The cockpit glass is toward the nose: find the physical (glossy) material.
    const glass = meshes(ship.group).find((m) => m.material instanceof THREE.MeshPhysicalMaterial)!;
    expect(glass).toBeDefined();
    expect(glass.position.z).toBeLessThan(0);
  });

  it('is left-right symmetrical (wings, panels and lights are mirror images)', () => {
    expect(Math.abs(centre.x)).toBeLessThan(0.005);
  });

  it('has its fin standing up above the hull, and nothing hanging far below it', () => {
    expect(box.max.y).toBeGreaterThan(0.2);
    expect(box.min.y).toBeGreaterThan(-0.14);
  });

  it('stays within a polygon budget a phone can draw (it is on screen alongside the whole Solar System)', () => {
    const total = meshes(ship.group).reduce((sum, m) => sum + triangles(m), 0);
    expect(total).toBeGreaterThan(3000); // it really is detailed
    expect(total).toBeLessThan(40_000);
  });

  it('has no NaN anywhere in its shapes', () => {
    for (const mesh of meshes(ship.group)) {
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.array.length; i++) {
        expect(Number.isFinite(positions.array[i]), `${mesh.geometry.type} vertex ${i}`).toBe(true);
      }
    }
  });
});

describe('the engine flames', () => {
  it('are off at rest and on under power, longer the harder it pushes', () => {
    const ship = createShipModel();
    expect(flames(ship.group)).toHaveLength(4); // a blue flame and a hot core, for each of two engines
    expect(flames(ship.group).every((f) => !f.visible)).toBe(true);

    ship.setThrottle(0.4);
    expect(flames(ship.group).every((f) => f.visible)).toBe(true);
    const half = Math.max(...flames(ship.group).map((f) => f.scale.z));
    ship.setThrottle(1);
    const full = Math.max(...flames(ship.group).map((f) => f.scale.z));
    expect(full).toBeGreaterThan(half);

    ship.setThrottle(0);
    expect(flames(ship.group).every((f) => !f.visible)).toBe(true);
  });

  it('are short when reversing (small thrusters) and still shown', () => {
    const ship = createShipModel();
    ship.setThrottle(1);
    const forward = Math.max(...flames(ship.group).map((f) => f.scale.z));
    ship.setThrottle(-0.3);
    expect(flames(ship.group).every((f) => f.visible)).toBe(true);
    expect(Math.max(...flames(ship.group).map((f) => f.scale.z))).toBeLessThan(forward / 3);
  });

  it('survive a nonsense throttle', () => {
    const ship = createShipModel();
    ship.setThrottle(Number.NaN);
    ship.setThrottle(Number.POSITIVE_INFINITY);
    for (const f of flames(ship.group))
      expect(Number.isFinite(f.scale.z) || f.scale.z === Infinity).toBe(true);
    ship.setThrottle(0);
    expect(flames(ship.group).every((f) => !f.visible)).toBe(true);
  });
});

describe('the navigation lights', () => {
  it('there are three, and they blink: bright for a moment, then dim', () => {
    const ship = createShipModel();
    expect(bulbs(ship.group)).toHaveLength(3);
    const brightness = (): number[] =>
      bulbs(ship.group).map((b) => {
        const c = (b.material as THREE.MeshBasicMaterial).color;
        return c.r + c.g + c.b;
      });
    ship.update(0); // the start of every blink: all on
    const on = brightness();
    ship.update(0.9); // the middle of the wingtip lights' dark time
    const off = brightness();
    expect(off[0]).toBeLessThan(on[0] * 0.6); // port (red)
    expect(off[1]).toBeLessThan(on[1] * 0.6); // starboard (green)
  });

  it('keeps working with a nonsense time', () => {
    const ship = createShipModel();
    expect(() => ship.update(Number.NaN)).not.toThrow();
  });
});

describe('cleaning up', () => {
  it('can be disposed (twice) without error', () => {
    const ship = createShipModel();
    expect(() => {
      ship.dispose();
      ship.dispose();
    }).not.toThrow();
  });
});

// The spacecraft's 3D model, built from code (no model files to download) and shaded like real hardware:
//   - a smooth, lathed fuselage with panel seams, rivets and markings (drawn textures, also used as a bump map);
//   - a glossy dark canopy, swept delta wings with winglets, a tail fin;
//   - a gold thermal-foil service ring and dark engine housings with flared bells and soft flames;
//   - solar panels on booms, an antenna dish, small thruster blocks and vents;
//   - blinking navigation lights (red left, green right, white behind).
// The surfaces use "physically based" materials (metalness and roughness) lit by the Sun, plus reflections of a small
// made-up space environment, so metal looks like metal. Proportions come from shipDesign.ts (tested).
//
// The nose points toward -Z, the same direction as yaw 0 (see flight.ts).
import * as THREE from 'three';
import { createComa, createTail, setGlowStrength } from './cometGlow';
import { mulberry32 } from './random';
import {
  NAVIGATION_LIGHTS,
  TAIL_Z,
  bellProfile,
  blink,
  dishProfile,
  finOutline,
  hullProfile,
  hullRadiusAt,
  wingOutline,
  type ProfilePoint,
} from './shipDesign';
import { createFoilBump, createHullTextures, createSolarTexture } from './shipTextures';

export interface ShipModel {
  /** Add this to the scene; move and turn it to follow the ship. */
  group: THREE.Group;
  /** The engine flames grow with the throttle (0 = off). */
  setThrottle(throttle: number): void;
  /** Call every frame with the time in seconds: makes the navigation lights blink. */
  update(seconds: number): void;
  /** Frees the textures and reflections (the shapes and materials are freed with the scene). */
  dispose(): void;
}

/** A small made-up space to reflect: a bright Sun, a blue glow like Earthshine, and a dark sky with a few stars. */
function createSpaceReflections(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050c);
  const bright = (r: number, g: number, b: number, scale: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(r * scale, g * scale, b * scale),
      side: THREE.DoubleSide,
    });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), bright(1, 0.93, 0.8, 40));
  sun.position.set(30, 18, -22);
  const earthshine = new THREE.Mesh(new THREE.PlaneGeometry(46, 26), bright(0.25, 0.5, 1, 3));
  earthshine.position.set(-28, -22, 18);
  earthshine.lookAt(0, 0, 0);
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(40, 3), bright(0.9, 0.95, 1, 4));
  rim.position.set(0, 26, 20);
  rim.lookAt(0, 0, 0);
  scene.add(sun, earthshine, rim);
  const random = mulberry32(17);
  for (let i = 0; i < 60; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.4, 4, 3), bright(1, 1, 1, 6));
    const direction = new THREE.Vector3(
      random() * 2 - 1,
      random() * 2 - 1,
      random() * 2 - 1,
    ).normalize();
    star.position.copy(direction.multiplyScalar(45));
    scene.add(star);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.03);
  generator.dispose();
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      (node.material as THREE.Material).dispose();
    }
  });
  return target;
}

/** Spins a profile (radius, distance toward the nose) round an axis that ends up along the ship, nose toward -Z. */
function lathe(profile: ProfilePoint[], segments: number): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(
    profile.map((p) => new THREE.Vector2(p.radius, p.along)),
    segments,
  );
  geometry.rotateX(-Math.PI / 2); // the lathe's up (+Y) becomes -Z
  return geometry;
}

/** A flat plate with the given outline in the XZ plane (x, z points), `thickness` thick and centred on y = 0. */
function plate(outline: Array<[number, number]>, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });
  geometry.rotateX(Math.PI / 2); // flat: the outline's second number becomes Z, the thickness runs up and down
  geometry.translate(0, thickness / 2, 0);
  return geometry;
}

export function createShipModel(renderer?: THREE.WebGLRenderer): ShipModel {
  const group = new THREE.Group();
  group.name = 'spacecraft';
  const reflections = renderer ? createSpaceReflections(renderer) : null;
  const envMap = reflections?.texture ?? null;
  const hullTextures = createHullTextures();
  const solarTexture = createSolarTexture();
  const foilBump = createFoilBump();
  foilBump.repeat.set(3, 1);

  // ---- materials ----
  const hull = new THREE.MeshStandardMaterial({
    color: 0xc6cad0,
    map: hullTextures.map,
    bumpMap: hullTextures.bump,
    bumpScale: 1.4,
    roughness: 0.48,
    metalness: 0.4,
    envMap,
    envMapIntensity: 1.3,
    // A faint glow of its own, in the plating's own pattern: space has no air to scatter sunlight into the shade, so
    // without this the side facing away from the Sun is black and the panels vanish.
    emissive: 0x3a4252,
    emissiveMap: hullTextures.map,
    emissiveIntensity: 0.55,
  });
  const wingSurface = hull.clone();
  wingSurface.map = hullTextures.map.clone();
  wingSurface.bumpMap = hullTextures.bump.clone();
  wingSurface.emissiveMap = wingSurface.map;
  for (const texture of [wingSurface.map, wingSurface.bumpMap]) {
    texture.repeat.set(3, 3);
    texture.needsUpdate = true;
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x07111c,
    roughness: 0.04,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMap,
    envMapIntensity: 2.4,
    emissive: 0x0a2c4a, // a faint glow from instruments inside
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x2c3036,
    roughness: 0.4,
    metalness: 0.85,
    envMap,
    envMapIntensity: 1.1,
  });
  const foil = new THREE.MeshStandardMaterial({
    color: 0xd9ac45,
    roughness: 0.3,
    metalness: 1,
    bumpMap: foilBump,
    bumpScale: 2.4,
    envMap,
    envMapIntensity: 1.4,
  });
  const solar = new THREE.MeshStandardMaterial({
    map: solarTexture,
    roughness: 0.28,
    metalness: 0.7,
    emissive: 0x0a1a46, // so the cells stay visible on the side facing away from the Sun
    envMap,
    envMapIntensity: 1.2,
  });
  const dishMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfe3e8,
    roughness: 0.35,
    metalness: 0.7,
    side: THREE.DoubleSide,
    envMap,
  });

  // ---- fuselage ----
  const fuselage = new THREE.Mesh(lathe(hullProfile(40), 64), hull);
  fuselage.scale.set(1, 0.78, 1); // a little flatter than round
  group.add(fuselage);

  // Dark plate closing the engine end.
  const bay = new THREE.Mesh(new THREE.CircleGeometry(hullRadiusAt(-TAIL_Z), 40), darkMetal);
  bay.position.z = TAIL_Z - 0.001;
  bay.scale.y = 0.78;
  group.add(bay);

  // Gold thermal-foil service ring round the widest part.
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.146, 0.06, 56, 1, true), foil);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.12;
  ring.scale.set(1, 1, 0.78); // after the turn, the cylinder's Z is the ship's Y: flatten it like the hull
  group.add(ring);
  for (const z of [0.09, 0.15]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.1425, 0.004, 8, 56), darkMetal);
    lip.position.z = z;
    lip.scale.y = 0.78;
    group.add(lip);
  }

  // ---- canopy ----
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.075, 36, 24), glass);
  canopy.scale.set(0.82, 0.55, 2.0);
  canopy.position.set(0, 0.062, -0.17);
  group.add(canopy);
  for (const z of [-0.26, -0.2, -0.14, -0.08]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.006), darkMetal); // frame bars across the glass
    bar.position.set(0, 0.098 - Math.abs(z + 0.17) * 0.18, z);
    group.add(bar);
  }

  // ---- wings, winglets and tail fin ----
  const wingGeometry = plate(wingOutline(), 0.014);
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(wingGeometry, wingSurface);
    wing.position.y = -0.02;
    wing.scale.x = side; // the left wing is the right one mirrored
    group.add(wing);
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.09), hull);
    winglet.position.set(side * 0.34, 0.012, 0.14);
    winglet.rotation.z = side * -0.25; // leaning slightly outward
    group.add(winglet);
  }
  const finShape = new THREE.Shape();
  finOutline().forEach(([z, y], i) => (i === 0 ? finShape.moveTo(z, y) : finShape.lineTo(z, y)));
  finShape.closePath();
  const fin = new THREE.Mesh(
    new THREE.ExtrudeGeometry(finShape, { depth: 0.012, bevelEnabled: false }),
    hull,
  );
  fin.geometry.rotateY(-Math.PI / 2); // the outline's first number becomes Z; the thickness runs side to side
  fin.geometry.translate(0.006, 0, 0);
  group.add(fin);

  // ---- engines ----
  const flames: Array<{ outer: THREE.Mesh; inner: THREE.Mesh }> = [];
  const throatRings: THREE.MeshStandardMaterial[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.07;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.12, 28), darkMetal);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(x, -0.006, 0.26);
    group.add(housing);
    const bell = new THREE.Mesh(lathe(bellProfile(), 32), darkMetal);
    bell.position.set(x, -0.006, 0.3);
    (bell.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    group.add(bell);
    const throat = new THREE.MeshStandardMaterial({
      color: 0x331a0a,
      emissive: 0xff7a2a,
      emissiveIntensity: 0,
    });
    throatRings.push(throat);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.005, 8, 28), throat);
    glow.position.set(x, -0.006, 0.305);
    group.add(glow);
    // Flames: soft cones, a pale blue one and a hotter white core inside it, pointing out of the tail (+Z).
    const outer = createTail(0x7fc4ff);
    outer.position.set(x, -0.006, 0.375);
    const inner = createTail(0xffffff);
    inner.position.set(x, -0.006, 0.375);
    group.add(outer, inner);
    flames.push({ outer, inner });
  }

  // ---- solar panels on booms, ahead of the wings ----
  for (const side of [-1, 1]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 10), darkMetal);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(side * 0.17, 0.004, -0.115);
    group.add(boom);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.004, 0.1), solar);
    panel.position.set(side * 0.27, 0.008, -0.115);
    group.add(panel);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.196, 0.003, 0.106), darkMetal);
    frame.position.set(side * 0.27, 0.004, -0.115);
    group.add(frame);
  }

  // ---- antenna dish on a mast ----
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.07, 10), darkMetal);
  mast.position.set(0, 0.138, -0.01);
  group.add(mast);
  const dish = new THREE.Mesh(
    new THREE.LatheGeometry(
      dishProfile().map((p) => new THREE.Vector2(p.radius, p.along)),
      28,
    ),
    dishMaterial,
  );
  dish.position.set(0, 0.176, -0.012);
  dish.rotation.x = -0.5; // opening up and toward the nose
  group.add(dish);

  // ---- thruster blocks and small vents scattered over the hull ----
  const random = mulberry32(41);
  const vents = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), darkMetal, 44);
  const placer = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    const z = -0.3 + random() * 0.5; // from near the nose to near the tail
    const angle = random() * Math.PI * 2;
    const r = hullRadiusAt(-z) + 0.002;
    placer.position.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.78, z);
    placer.rotation.set(0, 0, angle); // the box's local X points straight out of the hull
    placer.scale.set(0.004, 0.012 + random() * 0.02, 0.014 + random() * 0.03);
    placer.updateMatrix();
    vents.setMatrixAt(i, placer.matrix);
  }
  group.add(vents);
  for (const side of [-1, 1]) {
    for (const z of [-0.28, 0.02]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.018, 0.024), darkMetal);
      block.position.set(side * (hullRadiusAt(-z) + 0.004), 0, z);
      group.add(block);
    }
  }

  // ---- navigation lights ----
  const lights = NAVIGATION_LIGHTS.map((spec) => {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.007, 12, 8),
      new THREE.MeshBasicMaterial({ color: spec.color }),
    );
    const [lx, ly, lz] = spec.position;
    bulb.position.set(lx, ly, lz);
    const halo = createComa(0.034, spec.color);
    halo.position.set(lx, ly, lz);
    group.add(bulb, halo);
    return { spec, bulb, halo };
  });

  let throttle = 0;
  const applyThrottle = (): void => {
    const power = Math.abs(throttle);
    const reversing = throttle < 0;
    for (const { outer, inner } of flames) {
      // Reverse thrust is short, as if from small thrusters; forward thrust is long.
      const length = reversing ? 0.04 + power * 0.1 : 0.05 + power * 0.7;
      outer.visible = inner.visible = power > 0.02;
      outer.scale.set(0.055, 0.055, length);
      inner.scale.set(0.028, 0.028, length * 0.55);
      setGlowStrength(outer, 1.5);
      setGlowStrength(inner, 2);
    }
    for (const ringMaterial of throatRings) ringMaterial.emissiveIntensity = power * 2.2;
  };
  applyThrottle();

  return {
    group,
    setThrottle(value: number): void {
      throttle = Number.isFinite(value) ? value : 0;
      applyThrottle();
    },
    update(seconds: number): void {
      for (const { spec, bulb, halo } of lights) {
        const level = blink(seconds, spec.period);
        (bulb.material as THREE.MeshBasicMaterial).color
          .set(spec.color)
          .multiplyScalar(0.25 + 0.75 * level);
        setGlowStrength(halo, level * 0.9);
      }
    },
    dispose(): void {
      for (const texture of [
        hullTextures.map,
        hullTextures.bump,
        solarTexture,
        foilBump,
        wingSurface.map,
        wingSurface.bumpMap,
      ]) {
        texture?.dispose();
      }
      reflections?.dispose();
    },
  };
}

// The comet's solid parts, built with Three.js from the pure rules in cometNucleus.ts:
//   - the NUCLEUS: a lumpy, faceted "dirty snowball" with a dark crust and bright patches of ice;
//   - the DEBRIS: dozens of broken-up rocks and ice chunks, circling the nucleus and streaming into the tail.
// DECORATIVE: the real nucleus's size and shape are not known.
import * as THREE from 'three';
import {
  iceFraction,
  lumpiness,
  nucleusScale,
  placeDebris,
  type DebrisChunk,
} from './cometNucleus';

const CRUST = new THREE.Color(0x2a2623); // dark, dusty crust (real nuclei reflect only a few percent of the light)
const ICE = new THREE.Color(0xdbeaff); // bright ice showing through
const ROCK = new THREE.Color(0x4a443e);

/**
 * Turns an ordinary sphere mesh into the comet's nucleus: a lumpy, stretched shape with flat facets (so it looks
 * like broken rock, not a smooth moon) and a dark surface with patches of bright ice. Replaces the mesh's shape and
 * look in place, so the rest of the game (picking, selecting, the camera) treats it like any other body.
 */
export function shapeNucleus(nucleus: THREE.Mesh, radius: number): void {
  const geometry = new THREE.IcosahedronGeometry(radius, 3); // 3 levels of subdivision: about 1,300 small triangles
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const direction = new THREE.Vector3();
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    direction.fromBufferAttribute(position, i).normalize();
    // The same direction always gets the same distance, so triangles that share a corner stay joined (no cracks).
    const out = radius * nucleusScale(direction);
    position.setXYZ(i, direction.x * out, direction.y * out, direction.z * out);
    // Dark crust with bright ice showing through, and a little patchy variation in the crust itself.
    const patchy =
      0.75 + 0.25 * lumpiness({ x: direction.x * 5, y: direction.y * 5, z: direction.z * 5 }, 3);
    shade.copy(CRUST).multiplyScalar(patchy).lerp(ICE, iceFraction(direction));
    colors.set([shade.r, shade.g, shade.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  nucleus.geometry.dispose();
  nucleus.geometry = geometry;
  const material = nucleus.material as THREE.MeshStandardMaterial;
  material.color.set(0xffffff); // the colours now come from the surface itself
  material.vertexColors = true;
  material.flatShading = true; // visible facets: a rough, broken look
  material.roughness = 1;
  material.needsUpdate = true;
}

/** The pieces of debris as one object (one draw call, however many chunks), to be moved every frame. */
export interface Debris {
  mesh: THREE.InstancedMesh;
  chunks: DebrisChunk[];
}

export function createDebris(chunks: DebrisChunk[]): Debris {
  // One rough, low-detail rock shape. Each chunk gets its own size, stretch and spin, so no two look alike.
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const position = rock.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const wobble =
      1 +
      0.3 *
        lumpiness({ x: position.getX(i) * 2, y: position.getY(i) * 2, z: position.getZ(i) * 2 }, 5);
    position.setXYZ(
      i,
      position.getX(i) * wobble,
      position.getY(i) * wobble,
      position.getZ(i) * wobble,
    );
  }
  rock.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
    transparent: true, // it fades in and out with the replay
  });
  const mesh = new THREE.InstancedMesh(rock, material, chunks.length);
  const colour = new THREE.Color();
  chunks.forEach((chunk, i) => {
    // Bright ice or dark rock, with a little variation either way.
    colour.copy(chunk.icy ? ICE : ROCK).multiplyScalar(0.8 + (0.4 * ((i * 37) % 10)) / 10);
    mesh.setColorAt(i, colour);
  });
  mesh.instanceColor!.needsUpdate = true;
  mesh.frustumCulled = false; // the chunks move around, so the box Three.js computed once would be wrong
  mesh.renderOrder = 1;
  return { mesh, chunks };
}

const scratch = new THREE.Object3D();
const acrossA = new THREE.Vector3();
const acrossB = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const SIDEWAYS = new THREE.Vector3(1, 0, 0);

/**
 * Moves every chunk to where it is `seconds` after the start. `away` is the unit vector along the tail (away from
 * the Sun); the chunks are placed in that frame, so the stream always points down the tail. `trailLength` is how
 * long the stream is, and `fade` (0 to 1) fades everything with the replay.
 */
export function updateDebris(
  debris: Debris,
  seconds: number,
  nucleusRadius: number,
  trailLength: number,
  away: THREE.Vector3,
  fade: number,
): void {
  // Two directions across the tail, at right angles to it and to each other.
  acrossA.crossVectors(Math.abs(away.dot(UP)) > 0.95 ? SIDEWAYS : UP, away).normalize();
  acrossB.crossVectors(away, acrossA).normalize();
  const { mesh, chunks } = debris;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const place = placeDebris(chunk, seconds, nucleusRadius, trailLength);
    scratch.position
      .set(0, 0, 0)
      .addScaledVector(acrossA, place.offset.x)
      .addScaledVector(acrossB, place.offset.y)
      .addScaledVector(away, place.offset.z);
    scratch.rotation.set(seconds * chunk.spin, seconds * chunk.spin * 0.7 + i, i * 1.3);
    const size = place.size * fade;
    scratch.scale.set(size, size * chunk.stretch, size);
    scratch.updateMatrix();
    mesh.setMatrixAt(i, scratch.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  (mesh.material as THREE.MeshStandardMaterial).opacity = fade;
}

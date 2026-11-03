// The comet's glow and tails. DECORATIVE: they show that a comet has a cloud of gas round it and tails that point away
// from the Sun, not how bright or how long the real ones are (that depends on how active the comet is).
//
// Like the planets' haze (atmosphere.ts) these are see-through shapes with a small program (a "shader") that decides how
// see-through each point is:
//   - the COMA (the cloud round the nucleus) is a sphere that glows in the middle and fades to nothing at its edge;
//   - a TAIL is a cone with its tip at the comet. It fades along its length, and fades at its sides so the edges are
//     soft instead of looking like a hard-edged cone.
// Light is ADDED to what is behind (additive blending), so black means "invisible" and nothing needs sorting.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying float vAlong;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vAlong = position.z; // 0 at a tail's tip, 1 at its far end (the tail's geometry is built that way)
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Soft round glow: brightest where we look straight at the sphere, nothing at its edge. */
const comaFragment = /* glsl */ `
  uniform vec3 tint;
  uniform float strength;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  void main() {
    float facing = abs(dot(normalize(vNormalWorld), normalize(cameraPosition - vPositionWorld)));
    float amount = pow(facing, 2.2) * strength;
    gl_FragColor = vec4(tint * amount, amount);
  }
`;

/** A tail: strongest at the head, fading along its length, with soft sides. */
const tailFragment = /* glsl */ `
  uniform vec3 tint;
  uniform float strength;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying float vAlong;
  void main() {
    float facing = abs(dot(normalize(vNormalWorld), normalize(cameraPosition - vPositionWorld)));
    float soft = pow(facing, 1.3);                       // sides fade out
    float along = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.8); // the far end fades out
    float amount = soft * along * strength;
    gl_FragColor = vec4(tint * amount, amount);
  }
`;

function glowMaterial(color: number, fragmentShader: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** The glow round a nucleus, `radius` scene units across (its strength starts at 0: set it with `setGlowStrength`). */
export function createComa(radius: number, color = 0xbfe0ff): THREE.Mesh {
  const coma = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    glowMaterial(color, comaFragment),
  );
  coma.renderOrder = 2; // after the opaque bodies
  return coma;
}

/**
 * A tail of length 1 pointing along +Z with its tip at the origin and its far end 1 unit away. Scale it to size it
 * (x and y are its width, z its length) and turn it with its `quaternion` to point it.
 */
export function createTail(color: number): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(0.5, 1, 32, 8, true);
  geometry.rotateX(-Math.PI / 2); // tip toward -Z, base toward +Z...
  geometry.translate(0, 0, 0.5); // ...then slide it so the TIP is at the origin and the far end is at z = 1
  const tail = new THREE.Mesh(geometry, glowMaterial(color, tailFragment));
  tail.renderOrder = 2;
  tail.visible = false;
  return tail;
}

/** Sets how bright a glow or tail is (0 = invisible). */
export function setGlowStrength(glow: THREE.Mesh, strength: number): void {
  (glow.material as THREE.ShaderMaterial).uniforms.strength.value = strength;
}

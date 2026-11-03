// A thin glowing haze around a planet's edge ("atmosphere"). DECORATIVE: it shows that a world has air, not how
// thick or what colour the real air is.
//
// How it works: a slightly bigger, see-through sphere is drawn around the planet. A small program (a "shader")
// makes it glow only near its edge (the "fresnel" effect: surfaces seen at a slant glow more) and only on the
// side facing the Sun.
import * as THREE from 'three';
import type { AtmosphereSpec } from './effects';

const vertexShader = /* glsl */ `
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vCentreWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vCentreWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; // the planet's middle, in the world
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 glowColor;
  uniform float strength;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vCentreWorld;
  void main() {
    vec3 normal = normalize(vNormalWorld);
    vec3 toCamera = normalize(cameraPosition - vPositionWorld);
    // 0 when looking straight at the surface, 1 at the very edge.
    float edge = 1.0 - abs(dot(normal, toCamera));
    float rim = pow(edge, 3.0);
    // The Sun is at the middle of the scene, so "toward the Sun" from a planet is toward the origin.
    vec3 toSun = normalize(-vCentreWorld);
    float lit = smoothstep(-0.25, 0.6, dot(normal, toSun));
    float amount = rim * lit * strength;
    gl_FragColor = vec4(glowColor * amount, amount);
  }
`;

/** Builds the haze for a planet of radius `planetRadius`. Add the result as a CHILD of the planet's mesh. */
export function createAtmosphere(planetRadius: number, spec: AtmosphereSpec): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(spec.color) },
      strength: { value: spec.strength },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending, // adds light instead of covering what is behind
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(planetRadius * spec.thickness, 48, 32),
    material,
  );
  mesh.renderOrder = 2; // after the opaque planets
  return mesh;
}

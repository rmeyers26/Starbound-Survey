// The bloom (glow) post-processing pipeline.
//
// "Post-processing" means: instead of drawing the scene straight to the screen, draw it to a hidden picture
// first, then run extra steps over that picture (here: find the very bright parts, blur them, add them back),
// then show the result. It costs real GPU time, which is why only High and Balanced use it (spec).
//
// IMPORTANT: this file is loaded with a dynamic `import()` from webglView.ts, so the ~50 KB of Three.js
// post-processing code is a separate download that Performance-profile devices never fetch.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { BloomSettings } from './effects';

export interface BloomPipeline {
  /** Draws one frame (replaces `renderer.render`). */
  render(): void;
  /** Resize to the canvas size in CSS pixels and the current pixel ratio. */
  setSize(width: number, height: number, pixelRatio: number): void;
  /** Change strength, radius and threshold without rebuilding. */
  configure(settings: BloomSettings): void;
  /** Free the hidden pictures and shaders on the GPU. */
  dispose(): void;
}

export function createBloomPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  settings: BloomSettings,
): BloomPipeline {
  // The hidden picture uses 16-bit floating point so "brighter than white" values survive (that is how the
  // boosted Sun can pass the glow threshold). `samples` = smoothing of jagged edges, which the normal screen
  // would do for us but a hidden picture does not.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: settings.msaaSamples,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    settings.strength,
    settings.radius,
    settings.threshold,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // converts to the colours a screen expects

  let resolutionScale = settings.resolutionScale;
  let lastSize = { width: 1, height: 1, pixelRatio: 1 };

  const applySize = (): void => {
    composer.setPixelRatio(lastSize.pixelRatio);
    composer.setSize(lastSize.width, lastSize.height);
    // Reduced bloom does its blurring at half size: about 4 times cheaper, and the glow is soft anyway.
    bloom.setSize(
      lastSize.width * lastSize.pixelRatio * resolutionScale,
      lastSize.height * lastSize.pixelRatio * resolutionScale,
    );
  };

  return {
    render: () => composer.render(),
    setSize(width, height, pixelRatio) {
      lastSize = { width, height, pixelRatio };
      applySize();
    },
    configure(next) {
      bloom.strength = next.strength;
      bloom.radius = next.radius;
      bloom.threshold = next.threshold;
      if (next.resolutionScale !== resolutionScale) {
        resolutionScale = next.resolutionScale;
        applySize();
      }
    },
    dispose() {
      composer.dispose();
      target.dispose();
    },
  };
}

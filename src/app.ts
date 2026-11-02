// Puts the game together once the data has loaded: settings, renderer, quality, and UI.
import { createQualityController } from './engine/qualityController';
import { WebGLView } from './engine/webglView';
import type { View } from './engine/view';
import { EventBus, type GameEvents } from './game/events';
import { SettingsStore, defaultSettings, normalizeSettings, type Settings } from './game/settings';
import type { CelestialObject } from './game/types';
import { loadPrefs, savePrefs } from './save/prefs';
import { createFpsReadout } from './ui/fpsReadout';
import { createHud } from './ui/hud';
import { createInfoPanel } from './ui/infoPanel';
import { createSettingsPanel } from './ui/settingsPanel';

/** Builds and starts the game. Returns a function that tears everything down again. */
export function startApp(container: HTMLElement, objects: CelestialObject[]): () => void {
  const bus = new EventBus<GameEvents>();

  // Settings: the device's own "reduce motion" choice is the default (spec: accessibility).
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const defaults = defaultSettings(prefersReduced);
  const settings = new SettingsStore(
    normalizeSettings(loadPrefs(), defaults),
    defaults,
    savePrefs,
    bus,
  );

  let view: View | null = null;
  const quality = createQualityController(() => view, bus, settings);

  view = new WebGLView({
    host: container,
    objects,
    bus,
    quality: quality.currentQuality(),
    onFrame: quality.onFrame,
  });

  const applyControls = (s: Settings): void =>
    view?.setControlSettings({
      rotateSensitivity: s.rotateSensitivity,
      zoomSensitivity: s.zoomSensitivity,
      reducedMotion: s.reducedMotion,
    });
  applyControls(settings.get());
  const offSettings = bus.on('settings:changed', ({ settings: s }) => applyControls(s));

  const cleanups = [
    createHud(container, objects, bus),
    createInfoPanel(container, objects, bus),
    createFpsReadout(container, bus, settings.get().showFps),
    createSettingsPanel(container, settings, bus),
    offSettings,
    quality.dispose,
  ];

  view.start();
  return () => {
    cleanups.forEach((fn) => fn());
    view?.dispose();
  };
}

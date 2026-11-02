// Puts the game together once the data has loaded: settings, renderer, quality, and UI.
import { createQualityController } from './engine/qualityController';
import { ViewHost, readRendererOverride } from './engine/viewHost';
import { EventBus, type GameEvents } from './game/events';
import { SettingsStore, defaultSettings, normalizeSettings, type Settings } from './game/settings';
import type { CelestialObject } from './game/types';
import { loadPrefs, savePrefs } from './save/prefs';
import { createFpsReadout } from './ui/fpsReadout';
import { createHud } from './ui/hud';
import { createInfoPanel } from './ui/infoPanel';
import { createSettingsPanel } from './ui/settingsPanel';
import { createToaster } from './ui/toast';

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

  const toaster = createToaster(container);
  let view: ViewHost | null = null;
  const quality = createQualityController(() => view, bus, settings);

  view = new ViewHost({
    host: container,
    objects,
    bus,
    getQuality: quality.currentQuality,
    onFrame: quality.onFrame,
    forceCanvas: readRendererOverride(window.location.search) === 'canvas2d',
    onRendererChanged: (kind, reason) => {
      bus.emit('renderer:changed', { kind, reason });
      // Tell the player when something went wrong, but stay quiet on a normal start.
      if (reason === 'fallback') {
        toaster.show(
          '3D graphics are not available, so the game switched to a simplified star chart.',
        );
      } else if (reason === 'recovered') {
        toaster.show('The graphics card was reset. The 3D view has been restored.');
      }
    },
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
    toaster.dispose,
    quality.dispose,
  ];

  view.start();
  return () => {
    cleanups.forEach((fn) => fn());
    view?.dispose();
  };
}

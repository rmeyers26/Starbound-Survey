// Puts the game together once the data has loaded: settings, renderer, quality, and UI.
import { createQualityController } from './engine/qualityController';
import { ViewHost, readRendererOverride } from './engine/viewHost';
import { EventBus, type GameEvents } from './game/events';
import { recordInspection } from './game/progress';
import { SaveService } from './save/saveService';
import { openBestStore } from './save/stores';
import { SettingsStore, defaultSettings, normalizeSettings, type Settings } from './game/settings';
import type { CelestialObject } from './game/types';
import { loadPrefs, savePrefs } from './save/prefs';
import { createFpsReadout } from './ui/fpsReadout';
import { createHud } from './ui/hud';
import { createInfoPanel } from './ui/infoPanel';
import { createSaveSection } from './ui/saveSection';
import { createSettingsPanel } from './ui/settingsPanel';
import { createToaster } from './ui/toast';

/** Builds and starts the game. Returns a function that tears everything down again. */
export async function startApp(
  container: HTMLElement,
  objects: CelestialObject[],
): Promise<() => void> {
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

  // Saves: open IndexedDB (or fall back to memory), then load or create the save record.
  const { store, durable } = await openBestStore();
  const save = new SaveService(store, { durable });
  const loaded = await save.load();
  if (loaded.status === 'recovered') {
    toaster.show(
      'Your saved progress could not be read, so a fresh save was started. The old data was kept as a backup copy.',
      { durationMs: 15_000 },
    );
  }
  // Every time the player inspects an object, record it. The first save also asks the browser
  // to protect our data from being cleared (it may refuse, and nothing depends on the answer).
  let warnedAboutSaving = false;
  let askedForPersistence = false;
  const offSelected = bus.on('object:selected', ({ id }) => {
    if (!id) return;
    save
      .update((record) => recordInspection(record, id))
      .catch(() => {
        if (warnedAboutSaving) return;
        warnedAboutSaving = true;
        toaster.show(
          'Could not save your progress on this device. Try exporting a backup from Settings.',
        );
      });
    bus.emit('progress:changed', { record: save.current });
    if (!askedForPersistence) {
      askedForPersistence = true;
      void save.requestPersistence();
    }
  });
  const saveSection = createSaveSection(save, objects, bus, toaster);
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
    createSettingsPanel(container, settings, bus, [saveSection.element]),
    saveSection.dispose,
    offSelected,
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

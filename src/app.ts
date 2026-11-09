// Puts the game together once the data has loaded: settings, renderer, quality, and UI.
import { createQualityController } from './engine/qualityController';
import { readEffectsOverride } from './engine/effects';
import { ViewHost, readRendererOverride } from './engine/viewHost';
import { EventBus, type GameEvents } from './game/events';
import { mergeScans, practiceRecord, type PracticeScans } from './game/practice';
import { recordInspection } from './game/progress';
import { isObjectUnlocked, rankThatUnlocks } from './game/regions';
import { regionName } from './ui/format';
import { createScanController } from './game/scanController';
import { readScanSeconds } from './game/scanner';
import { GameStateMachine } from './game/stateMachine';
import { SaveService } from './save/saveService';
import { openBestStore } from './save/stores';
import { SettingsStore, defaultSettings, normalizeSettings, type Settings } from './game/settings';
import type { CelestialObject } from './game/types';
import { achievementMessage, earnedAchievementIds, newlyEarned, rankUpMessage } from './game/goals';
import { createMissionController } from './game/missionController';
import type { Mission } from './game/missions';
import type { SaveRecord } from './save/schema';
import { loadPrefs, savePrefs } from './save/prefs';
import { createFpsReadout } from './ui/fpsReadout';
import { createGoalChip } from './ui/goalChip';
import { createMissionsPanel } from './ui/missionsPanel';
import { createHud } from './ui/hud';
import { createInfoPanel } from './ui/infoPanel';
import { createLogbook } from './ui/logbook';
import { createPilotPanel } from './ui/pilotPanel';
import { createSaveSection } from './ui/saveSection';
import { createScanHud, createXpBar } from './ui/scanHud';
import { createSettingsPanel } from './ui/settingsPanel';
import { createToaster } from './ui/toast';
import { maybeShowInstallHint } from './ui/installHint';
import { registerServiceWorker } from './pwa';

/** Builds and starts the game. Returns a function that tears everything down again. */
export async function startApp(
  container: HTMLElement,
  objects: CelestialObject[],
  /** The guided missions (may be empty: the game works without them). */
  missions: Mission[] = [],
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
  // Practice mode (a setting): the game reads a VIRTUAL record (everything unlocked, best scanner) instead of the
  // saved one, and practice scans are kept in memory only. See game/practice.ts.
  let practiceScans: PracticeScans = {};
  const isPractice = (): boolean => settings.get().practiceMode;
  /** The record the game should use right now: the real save, or the practice overlay. */
  const effectiveRecord = (): SaveRecord =>
    isPractice() ? practiceRecord(save.current, practiceScans) : save.current;
  // Every time the player inspects an object, record it. The first save also asks the browser
  // to protect our data from being cleared (it may refuse, and nothing depends on the answer).
  let warnedAboutSaving = false;
  let askedForPersistence = false;
  let selectedId: string | null = null;
  const offSelected = bus.on('object:selected', ({ id }) => {
    selectedId = id;
    if (!id || isPractice()) return; // practice never touches the saved progress
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
    getUnlockedRegions: () => effectiveRecord().unlockedRegions,
    onFrame: quality.onFrame,
    forceCanvas: readRendererOverride(window.location.search) === 'canvas2d',
    effectsOff: readEffectsOverride(window.location.search) === 'off',
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

  // The game's single "what is happening now" state (spec: game state machine).
  const machine = new GameStateMachine(bus);
  machine.transition('TITLE'); // no title screen yet: go straight through to exploring
  machine.transition('EXPLORE');

  // Missions always use the REAL save (practice never changes saved progress, so missions are paused there).
  const missionController = createMissionController({
    bus,
    missions,
    getRecord: () => save.current,
    isPractice,
    commit: (change) =>
      save.update(change).catch(() => {
        if (warnedAboutSaving) return;
        warnedAboutSaving = true;
        toaster.show(
          'Could not save your progress on this device. Try exporting a backup from Settings.',
        );
      }),
  });

  const scan = createScanController({
    bus,
    machine,
    objects,
    getRecord: effectiveRecord,
    isPractice,
    commit: (change) => {
      if (isPractice()) {
        // Practice scans reveal data but are never saved: run the change on the overlay, keep only the scans.
        practiceScans = mergeScans(practiceScans, change(effectiveRecord()).scannedObjects);
        return Promise.resolve();
      }
      return save.update(change).catch(() => {
        if (warnedAboutSaving) return;
        warnedAboutSaving = true;
        toaster.show(
          'Could not save your progress on this device. Try exporting a backup from Settings.',
        );
      });
    },
    getSelectedId: () => selectedId,
    getDistance: (id) => view?.distanceTo(id) ?? null,
    getSettings: () => settings.get(),
    scanSeconds: readScanSeconds(window.location.search),
  });
  // Show or hide bodies whenever progress could have changed which regions are unlocked (a rank-up, or a
  // backup being imported). If the selected object just became locked, clear the selection.
  const syncRegions = (): void => {
    view?.setUnlockedRegions(effectiveRecord().unlockedRegions);
    const current = objects.find((o) => o.id === selectedId);
    if (current && !isObjectUnlocked(current, effectiveRecord())) {
      bus.emit('object:selected', { id: null });
      bus.emit('camera:focus', { id: null });
    }
  };
  const offRegionsA = bus.on('rank:up', syncRegions);
  const offRegionsB = bus.on('progress:changed', syncRegions);
  // Switching practice mode on or off changes what is unlocked, so update the views, buttons and bars.
  let wasPractice = isPractice();
  const offPractice = bus.on('settings:changed', () => {
    if (isPractice() === wasPractice) return;
    wasPractice = isPractice();
    syncRegions();
    bus.emit('progress:changed', { record: effectiveRecord() });
    toaster.show(
      wasPractice
        ? 'Practice mode on: everything is unlocked and scans give no XP. Your saved progress is untouched.'
        : 'Practice mode off: back to your real progress.',
    );
  });
  // Tapping a locked object's button explains how to unlock it.
  const offLocked = bus.on('object:locked', ({ id }) => {
    const object = objects.find((o) => o.id === id);
    if (!object) return;
    const rank = rankThatUnlocks(object.region);
    toaster.show(
      `${object.name} is in the ${regionName(object.region)}.` +
        (rank ? ` Reach ${rank.name} to unlock it.` : ' It is not unlocked yet.'),
    );
  });
  const offRankUp = bus.on('rank:up', ({ rank, newRegions }) => {
    toaster.show(rankUpMessage(rank, newRegions, objects, regionName), { durationMs: 12_000 });
  });

  // Achievements are worked out from the REAL save (practice scans never count). We remember what was already
  // earned, and congratulate only for what a scan has just added.
  //
  // ORDER MATTERS. The screen shows at most two toasts and removes the oldest first, and on an iPhone the
  // "Add to Home Screen" tip stays up as one of them. So the achievement message must come BEFORE the rank-up
  // message (a scan emits "scan:completed" first, then "rank:up"): the rank-up is the bigger moment and must be the
  // newest toast, the one that survives. All achievements of one scan share a single toast for the same reason.
  let knownAchievements = earnedAchievementIds(save.current, objects);
  const announceAchievements = (): void => {
    const earnedNow = earnedAchievementIds(save.current, objects);
    if (!isPractice()) {
      const message = achievementMessage(newlyEarned(knownAchievements, earnedNow));
      if (message) toaster.show(message, { durationMs: 9000 });
    }
    knownAchievements = earnedNow;
  };
  // Both a finished scan and a mission answer can earn achievements (a mission's XP can cause a rank-up). Both
  // announce BEFORE their 'rank:up', so the rank-up message stays the newest.
  const offScanDone = bus.on('scan:completed', announceAchievements);
  const offMissionAnswered = bus.on('mission:answered', announceAchievements);
  // Anything that is not a scan (importing a backup, for example) updates what is known, silently.
  const offAchievements = bus.on('progress:changed', () => {
    knownAchievements = earnedAchievementIds(save.current, objects);
  });

  const cleanups = [
    createHud(container, objects, bus, machine, effectiveRecord),
    createXpBar(container, bus, effectiveRecord, isPractice),
    createGoalChip(container, objects, bus, effectiveRecord, missions, isPractice),
    createMissionsPanel(
      container,
      missions,
      objects,
      bus,
      machine,
      () => save.current,
      missionController,
      isPractice,
    ),
    createScanHud(container, bus, objects, () => settings.get()),
    createLogbook(container, objects, bus, machine, effectiveRecord, () => save.current),
    createInfoPanel(container, objects, bus, effectiveRecord),
    // The spacecraft needs the 3D view; the simplified 2D star chart cannot show it.
    createPilotPanel(container, bus, objects, () => view?.kind === 'webgl2'),
    scan.dispose,
    offScanDone,
    offMissionAnswered,
    offAchievements,
    offRankUp,
    offRegionsA,
    offRegionsB,
    offPractice,
    offLocked,
    createFpsReadout(container, bus, settings.get().showFps),
    createSettingsPanel(container, settings, bus, [saveSection.element]),
    saveSection.dispose,
    offSelected,
    offSettings,
    toaster.dispose,
    quality.dispose,
  ];

  view.start();
  registerServiceWorker(toaster);
  maybeShowInstallHint(toaster);
  return () => {
    cleanups.forEach((fn) => fn());
    view?.dispose();
  };
}

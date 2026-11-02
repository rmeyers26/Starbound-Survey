// Glue between the QualityManager (pure logic), the player's settings, and the running view.
import type { EventBus, GameEvents } from '../game/events';
import type { SettingsStore } from '../game/settings';
import { FrameStats } from './frameStats';
import { log } from './log';
import {
  defaultProfileFor,
  ladderIndexFor,
  readDeviceHints,
  toViewQuality,
  type DeviceHints,
  type Level,
  type ProfileName,
} from './profiles';
import { QualityManager } from './qualityManager';
import type { View, ViewQuality } from './view';

export interface QualityController {
  /** Pass to the view as `onFrame`. */
  onFrame(frameMs: number): void;
  /** The quality the view should be created with. */
  currentQuality(): ViewQuality;
  dispose(): void;
}

export function createQualityController(
  getView: () => View | null,
  bus: EventBus<GameEvents>,
  settings: SettingsStore,
  hints: DeviceHints = readDeviceHints(),
): QualityController {
  const deviceDefault: ProfileName = defaultProfileFor(hints);
  const manager = new QualityManager(ladderIndexFor(deviceDefault));
  const stats = new FrameStats();

  /** Apply the player's profile choice: 'auto' = device default + adaptive; otherwise locked. */
  function applyChoice(announce: boolean): void {
    const choice = settings.get().profile;
    if (choice === 'auto') manager.setAuto(ladderIndexFor(deviceDefault));
    else manager.setManual(ladderIndexFor(choice));
    pushLevel(manager.level, choice === 'auto' ? 'auto' : 'manual', announce);
  }

  function pushLevel(level: Level, reason: 'auto' | 'manual', announce: boolean): void {
    getView()?.setQuality(toViewQuality(level));
    log('Quality level', level, reason);
    if (announce) {
      bus.emit('quality:changed', {
        profile: level.profile,
        resolutionScale: level.resolutionScale,
        reason,
      });
    }
  }

  let lastChoice = settings.get().profile;
  const unsubscribe = bus.on('settings:changed', ({ settings: s }) => {
    if (s.profile !== lastChoice) {
      lastChoice = s.profile;
      applyChoice(true);
    }
  });
  manager.setAuto(ladderIndexFor(deviceDefault));
  if (lastChoice !== 'auto') manager.setManual(ladderIndexFor(lastChoice));

  return {
    onFrame(frameMs) {
      stats.record(frameMs);
      const result = manager.recordFrame(frameMs);
      if (!result) return;
      const level = manager.level;
      if (result.changedTo) pushLevel(result.changedTo, 'auto', true);
      bus.emit('quality:sample', {
        fps: result.fps,
        profile: level.profile,
        resolutionScale: level.resolutionScale,
        renderer: getView()?.kind ?? 'none',
        slowFramePercent: stats.slowPercent,
      });
    },
    currentQuality: () => toViewQuality(manager.level),
    dispose: unsubscribe,
  };
}

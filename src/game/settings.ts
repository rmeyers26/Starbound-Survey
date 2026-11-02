// Player settings. `normalizeSettings` is the single gatekeeper: whatever is read from storage
// (maybe old, maybe edited by hand) is checked here, so the rest of the game can trust it.
import type { EventBus, GameEvents } from './events';

export type ProfileChoice = 'auto' | 'high' | 'balanced' | 'performance';
export const PROFILE_CHOICES: readonly ProfileChoice[] = [
  'auto',
  'high',
  'balanced',
  'performance',
];

export type ScanMode = 'hold' | 'tap';
export const SCAN_MODES: readonly ScanMode[] = ['hold', 'tap'];

export interface Settings {
  profile: ProfileChoice;
  showFps: boolean;
  rotateSensitivity: number; // 1 = default
  zoomSensitivity: number; // 1 = default
  reducedMotion: boolean;
  /** 'hold' = keep the SCAN control pressed (spec). 'tap' = one tap starts a scan (no holding needed). */
  scanMode: ScanMode;
}

export const SENSITIVITY_MIN = 0.25;
export const SENSITIVITY_MAX = 3;

/** `prefersReducedMotion` comes from the device setting (spec: default to the device's own setting). */
export function defaultSettings(prefersReducedMotion: boolean): Settings {
  return {
    profile: 'auto',
    showFps: false,
    rotateSensitivity: 1,
    zoomSensitivity: 1,
    reducedMotion: prefersReducedMotion,
    scanMode: 'hold',
  };
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampSensitivity = (v: number): number =>
  Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, v));

/** Keeps every valid field from `raw`; replaces anything missing or invalid with the default. */
export function normalizeSettings(raw: unknown, defaults: Settings): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    profile: PROFILE_CHOICES.includes(r.profile as ProfileChoice)
      ? (r.profile as ProfileChoice)
      : defaults.profile,
    showFps: typeof r.showFps === 'boolean' ? r.showFps : defaults.showFps,
    rotateSensitivity: isNumber(r.rotateSensitivity)
      ? clampSensitivity(r.rotateSensitivity)
      : defaults.rotateSensitivity,
    zoomSensitivity: isNumber(r.zoomSensitivity)
      ? clampSensitivity(r.zoomSensitivity)
      : defaults.zoomSensitivity,
    reducedMotion: typeof r.reducedMotion === 'boolean' ? r.reducedMotion : defaults.reducedMotion,
    scanMode: SCAN_MODES.includes(r.scanMode as ScanMode)
      ? (r.scanMode as ScanMode)
      : defaults.scanMode,
  };
}

/** Holds the current settings, saves them on change, and announces changes on the event bus. */
export class SettingsStore {
  private current: Settings;
  private readonly defaults: Settings;
  private readonly persist: (settings: Settings) => void;
  private readonly bus: EventBus<GameEvents>;

  constructor(
    initial: Settings,
    defaults: Settings,
    persist: (settings: Settings) => void,
    bus: EventBus<GameEvents>,
  ) {
    this.current = initial;
    this.defaults = defaults;
    this.persist = persist;
    this.bus = bus;
  }

  get(): Settings {
    return this.current;
  }

  update(patch: Partial<Settings>): void {
    this.current = normalizeSettings({ ...this.current, ...patch }, this.defaults);
    this.persist(this.current);
    this.bus.emit('settings:changed', { settings: this.current });
  }
}

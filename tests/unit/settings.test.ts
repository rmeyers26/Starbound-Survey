import { describe, it, expect, vi } from 'vitest';
import { EventBus, type GameEvents } from '../../src/game/events';
import { SettingsStore, defaultSettings, normalizeSettings } from '../../src/game/settings';

const defaults = defaultSettings(false);

describe('normalizeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(normalizeSettings(null, defaults)).toEqual(defaults);
    expect(normalizeSettings('hello', defaults)).toEqual(defaults);
    expect(normalizeSettings([1, 2], defaults)).toEqual(defaults);
  });
  it('keeps valid fields and replaces invalid ones individually', () => {
    const result = normalizeSettings(
      { profile: 'high', showFps: 'yes', zoomSensitivity: 2 },
      defaults,
    );
    expect(result.profile).toBe('high');
    expect(result.showFps).toBe(false); // invalid -> default
    expect(result.zoomSensitivity).toBe(2);
  });
  it('clamps sensitivity into the allowed range', () => {
    expect(normalizeSettings({ rotateSensitivity: 99 }, defaults).rotateSensitivity).toBe(3);
    expect(normalizeSettings({ rotateSensitivity: -4 }, defaults).rotateSensitivity).toBe(0.25);
    expect(normalizeSettings({ rotateSensitivity: NaN }, defaults).rotateSensitivity).toBe(1);
  });
  it('rejects an unknown profile name', () => {
    expect(normalizeSettings({ profile: 'ultra' }, defaults).profile).toBe('auto');
  });
  it('the device reduced-motion preference becomes the default', () => {
    expect(defaultSettings(true).reducedMotion).toBe(true);
  });
});

describe('SettingsStore', () => {
  it('validates, saves and announces updates', () => {
    const bus = new EventBus<GameEvents>();
    const persist = vi.fn();
    const heard = vi.fn();
    bus.on('settings:changed', heard);
    const store = new SettingsStore(defaults, defaults, persist, bus);
    store.update({ rotateSensitivity: 50 }); // too big: gets clamped
    expect(store.get().rotateSensitivity).toBe(3);
    expect(persist).toHaveBeenCalledWith(store.get());
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

// Small preferences in localStorage (spec: "localStorage: small preferences only").
// Everything is wrapped in try/catch because localStorage can throw or be missing
// (private windows, blocked site data), and the game must still work without it.
import { log } from '../engine/log';

const KEY = 'starbound.prefs.v1';

/** Returns the stored object, or null when nothing usable is stored. */
export function loadPrefs(): unknown {
  try {
    const text = localStorage.getItem(KEY);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    log('Could not read preferences', error);
    return null;
  }
}

export function savePrefs(value: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (error) {
    log('Could not save preferences', error);
  }
}

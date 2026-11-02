// Asks the browser to look for a new version of the game (the service worker script).
// Why this exists: browsers only re-check on page navigation if 24+ hours have passed, so someone who
// reopens the installed game daily could stay on an old version. We check ourselves, but gently:
// never while offline, and never more often than `minGapMs`.
export interface UpdatableRegistration {
  update(): Promise<unknown>;
}

export interface UpdateCheckerOptions {
  /** Minimum time between checks. */
  minGapMs: number;
  now?: () => number;
  isOnline?: () => boolean;
}

export function createUpdateChecker(
  registration: UpdatableRegistration,
  options: UpdateCheckerOptions,
): () => Promise<boolean> {
  const now = options.now ?? (() => Date.now());
  const isOnline = options.isOnline ?? (() => navigator.onLine);
  let lastCheck = -Infinity;

  /** Returns true if a check was actually made. */
  return async () => {
    if (!isOnline()) return false;
    if (now() - lastCheck < options.minGapMs) return false;
    lastCheck = now();
    try {
      await registration.update();
    } catch {
      // A failed check (flaky network) is harmless: we will simply try again later.
    }
    return true;
  };
}

// A one-time hint explaining "Add to Home Screen" on iPhone/iPad. Safari has no automatic install
// prompt, and installed web apps are the ones Safari protects from clearing saved data.
import type { Toaster } from './toast';

const FLAG_KEY = 'starbound.installHintShown';

export interface InstallEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Already running as an installed app? */
  standalone: boolean;
  /** Has the player already seen (and dismissed) the hint? */
  alreadyShown: boolean;
}

/** iPhone, iPod, iPad. Newer iPads pretend to be Macs, so also check for a touch screen. */
export function isIosDevice(
  env: Pick<InstallEnvironment, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): boolean {
  if (/iPad|iPhone|iPod/.test(env.userAgent)) return true;
  return env.platform === 'MacIntel' && env.maxTouchPoints > 1;
}

/** Show the hint only on iOS, only in the browser (not once installed), and only once ever. */
export function shouldShowInstallHint(env: InstallEnvironment): boolean {
  return isIosDevice(env) && !env.standalone && !env.alreadyShown;
}

function readFlag(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false; // storage blocked: treat as not shown (worst case: shown again next visit)
  }
}

function writeFlag(): void {
  try {
    localStorage.setItem(FLAG_KEY, '1');
  } catch {
    /* ignore: the hint is a convenience, not a requirement */
  }
}

export function maybeShowInstallHint(toaster: Toaster, delayMs = 6000): void {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  const env: InstallEnvironment = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
    alreadyShown: readFlag(),
  };
  if (!shouldShowInstallHint(env)) return;

  // Wait a few seconds so the player sees the game first, not a pop-up.
  window.setTimeout(() => {
    toaster.show(
      'Tip: tap the Share button, then "Add to Home Screen". The game opens full screen, works offline, and your saved progress is better protected.',
      { actionLabel: 'Got it', onAction: writeFlag, durationMs: 0 },
    );
    writeFlag(); // "shown once": even if dismissed with the × button, never nag again
  }, delayMs);
}

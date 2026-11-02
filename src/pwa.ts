// Registers the service worker (the small background script that enables offline play) and
// shows quiet prompts. Only active in the production build: during development a service worker
// would cache old code and make debugging confusing.
import { registerSW } from 'virtual:pwa-register';
import { log } from './engine/log';
import { createUpdateChecker } from './updateChecker';
import type { Toaster } from './ui/toast';

export function registerServiceWorker(toaster: Toaster): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const updateServiceWorker = registerSW({
    // A new version has been downloaded and is waiting. We ask; we never reload on our own.
    onNeedRefresh() {
      toaster.show('A new version of Starbound Survey is ready.', {
        actionLabel: 'Reload',
        onAction: () => {
          // Reload once the new worker has taken control. We listen for the browser's own
          // `controllerchange` signal because it is reliable however the update was discovered
          // (the helper library only reloads for updates it considers "its own").
          let reloading = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloading) return; // guard against a double reload
            reloading = true;
            window.location.reload();
          });
          void updateServiceWorker(false); // false = just tell the waiting worker to take over
        },
        durationMs: 0, // stays until the player decides
      });
    },
    // Everything needed to play offline has been cached (first visit only).
    onOfflineReady() {
      toaster.show('Ready to play offline.');
    },
    // Once registered, keep looking for new versions: when the game returns to the foreground,
    // and once an hour while it stays open.
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = createUpdateChecker(registration, { minGapMs: 5 * 60_000 });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check();
      });
      window.setInterval(() => void check(), 60 * 60_000);
    },
    onRegisterError(error) {
      log('Service worker registration failed', error);
    },
  });
}

// Small, quiet notifications (spec: "a quiet 'update available' prompt rather than a surprise reload").
// role="status" makes screen readers announce the message politely.
import { el } from './dom';

export interface ToastOptions {
  /** Optional button, e.g. "Reload". */
  actionLabel?: string;
  onAction?: () => void;
  /** 0 = stay until dismissed. Default 8 seconds. */
  durationMs?: number;
}

export interface Toaster {
  show(message: string, options?: ToastOptions): void;
  dispose(): void;
}

/** The most notifications shown at once. More than this would pile up over the game's own buttons. */
export const MAX_VISIBLE_TOASTS = 2;

/**
 * Decides which toasts to remove so that at most `max` remain, as a list of positions (0 = oldest).
 * Oldest go first, but a toast with an action button (such as "A new version is ready: Reload") is only
 * removed when nothing else can be, because losing it would lose the player's one chance to act.
 */
export function toastsToEvict(
  toasts: ReadonlyArray<{ hasAction: boolean }>,
  max: number,
): number[] {
  const excess = toasts.length - max;
  if (excess <= 0) return [];
  const plain = toasts.map((t, i) => (t.hasAction ? -1 : i)).filter((i) => i >= 0);
  const withAction = toasts.map((t, i) => (t.hasAction ? i : -1)).filter((i) => i >= 0);
  return [...plain, ...withAction].slice(0, excess).sort((a, b) => a - b);
}

export function createToaster(container: HTMLElement): Toaster {
  const region = el('div', 'toast-region');
  region.setAttribute('role', 'status');
  container.append(region);
  const timers = new Set<number>();
  /** The toasts on screen, oldest first. */
  const live: Array<{ element: HTMLElement; hasAction: boolean; timer?: number }> = [];

  return {
    show(message, options = {}) {
      const toast = el('div', 'toast');
      toast.append(el('span', 'toast-text', message));
      const entry: { element: HTMLElement; hasAction: boolean; timer?: number } = {
        element: toast,
        hasAction: Boolean(options.actionLabel && options.onAction),
      };
      const remove = (): void => {
        toast.remove();
        if (entry.timer !== undefined) {
          window.clearTimeout(entry.timer);
          timers.delete(entry.timer);
        }
        const at = live.indexOf(entry);
        if (at >= 0) live.splice(at, 1);
      };

      if (options.actionLabel && options.onAction) {
        const action = el('button', 'hud-button toast-button', options.actionLabel);
        action.type = 'button';
        action.addEventListener('click', () => {
          options.onAction?.();
          remove();
        });
        toast.append(action);
      }
      const dismiss = el('button', 'toast-dismiss', '×');
      dismiss.type = 'button';
      dismiss.setAttribute('aria-label', 'Dismiss notification');
      dismiss.addEventListener('click', remove);
      toast.append(dismiss);
      region.append(toast);
      live.push(entry);

      const duration = options.durationMs ?? 8000;
      if (duration > 0) {
        entry.timer = window.setTimeout(remove, duration);
        timers.add(entry.timer);
      }

      // Keep the stack short so it never buries the game's buttons.
      const evict = toastsToEvict(live, MAX_VISIBLE_TOASTS);
      for (const index of [...evict].reverse()) {
        const doomed = live[index];
        doomed.element.remove();
        if (doomed.timer !== undefined) {
          window.clearTimeout(doomed.timer);
          timers.delete(doomed.timer);
        }
        live.splice(index, 1);
      }
    },
    dispose() {
      timers.forEach((id) => window.clearTimeout(id));
      live.length = 0;
      region.remove();
    },
  };
}

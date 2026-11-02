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

export function createToaster(container: HTMLElement): Toaster {
  const region = el('div', 'toast-region');
  region.setAttribute('role', 'status');
  container.append(region);
  const timers = new Set<number>();

  return {
    show(message, options = {}) {
      const toast = el('div', 'toast');
      toast.append(el('span', 'toast-text', message));
      const remove = (): void => toast.remove();

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

      const duration = options.durationMs ?? 8000;
      if (duration > 0) {
        const id = window.setTimeout(remove, duration);
        timers.add(id);
      }
    },
    dispose() {
      timers.forEach((id) => window.clearTimeout(id));
      region.remove();
    },
  };
}

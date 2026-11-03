import { describe, expect, it } from 'vitest';
import { MAX_VISIBLE_TOASTS, toastsToEvict } from '../../src/ui/toast';

const plain = { hasAction: false };
const action = { hasAction: true };

describe('toastsToEvict (keeping the notification stack short)', () => {
  it('removes nothing while there is room', () => {
    expect(toastsToEvict([], 2)).toEqual([]);
    expect(toastsToEvict([plain], 2)).toEqual([]);
    expect(toastsToEvict([plain, plain], 2)).toEqual([]);
  });

  it('removes the oldest first', () => {
    expect(toastsToEvict([plain, plain, plain], 2)).toEqual([0]);
    expect(toastsToEvict([plain, plain, plain, plain, plain], 2)).toEqual([0, 1, 2]);
  });

  it('keeps a toast with an action button (like "Reload") rather than a plain one', () => {
    // The oldest is the important "update ready" toast: a newer plain one goes instead.
    expect(toastsToEvict([action, plain, plain], 2)).toEqual([1]);
    expect(toastsToEvict([action, plain, plain, plain], 2)).toEqual([1, 2]);
  });

  it('only removes an action toast when nothing else can go', () => {
    expect(toastsToEvict([action, action, action], 2)).toEqual([0]);
    // The plain one goes first, then the oldest action toast; the answer is listed in order of position.
    expect(toastsToEvict([action, plain, action, action], 2)).toEqual([0, 1]);
  });

  it('always leaves at most the maximum, and never asks to remove the same toast twice', () => {
    for (let count = 0; count <= 8; count++) {
      for (let mask = 0; mask < 1 << Math.min(count, 8); mask++) {
        const toasts = Array.from({ length: count }, (_, i) => ({
          hasAction: Boolean((mask >> i) & 1),
        }));
        const evict = toastsToEvict(toasts, MAX_VISIBLE_TOASTS);
        expect(new Set(evict).size).toBe(evict.length);
        expect(count - evict.length).toBeLessThanOrEqual(MAX_VISIBLE_TOASTS);
        expect(evict.every((i) => i >= 0 && i < count)).toBe(true);
      }
    }
  });

  it('allows two notifications at once', () => {
    expect(MAX_VISIBLE_TOASTS).toBe(2);
  });
});

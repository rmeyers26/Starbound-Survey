// Turns raw pointer events (finger or mouse) into meaningful gestures.
// It is pure logic: no DOM, and time is passed in, so it is easy to unit test.
//
// Gestures (spec: "Touch-first navigation"):
//   one-finger drag -> onDrag      two-finger pinch -> onPinch
//   quick tap       -> onTap       two quick taps   -> onDoubleTap
// There is deliberately NO long-press (it would clash with "Hold to SCAN" later).

export interface GestureCallbacks {
  onDrag(dx: number, dy: number): void;
  /** ratio > 1 means the fingers moved apart (zoom in), < 1 together (zoom out). */
  onPinch(ratio: number): void;
  onTap(x: number, y: number): void;
  onDoubleTap(x: number, y: number): void;
}

export const TAP_MAX_MOVE_PX = 10; // moving further than this makes it a drag, not a tap
export const TAP_MAX_MS = 300; // holding longer than this is not a tap
export const DOUBLE_TAP_MAX_MS = 350; // gap between the two taps of a double tap
export const DOUBLE_TAP_MAX_DIST_PX = 30;

interface Pointer {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  /** True once this touch can no longer count as a tap (it moved, or a 2nd finger joined). */
  disqualified: boolean;
  /** True once the finger has travelled far enough to count as dragging the view. */
  dragging: boolean;
}

export class GestureClassifier {
  private readonly pointers = new Map<number, Pointer>();
  private lastTap: { x: number; y: number; time: number } | null = null;
  private readonly callbacks: GestureCallbacks;

  constructor(callbacks: GestureCallbacks) {
    this.callbacks = callbacks;
  }

  pointerDown(id: number, x: number, y: number, time: number): void {
    this.pointers.set(id, {
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      startTime: time,
      disqualified: false,
      dragging: false,
    });
    // A second finger means "pinch": nobody's touch is a tap any more.
    if (this.pointers.size > 1) {
      for (const p of this.pointers.values()) {
        p.disqualified = true;
        p.dragging = false;
      }
      this.lastTap = null;
    }
  }

  pointerMove(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const before = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
      pointer.lastX = x;
      pointer.lastY = y;
      const after = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
      if (before > 0 && after > 0) this.callbacks.onPinch(after / before);
      return;
    }

    const dx = x - pointer.lastX;
    const dy = y - pointer.lastY;
    pointer.lastX = x;
    pointer.lastY = y;
    if (this.pointers.size !== 1) return;

    if (!pointer.dragging) {
      const moved = Math.hypot(x - pointer.startX, y - pointer.startY);
      if (moved <= TAP_MAX_MOVE_PX) return; // still within "finger wobble" distance
      pointer.dragging = true;
      pointer.disqualified = true;
      this.lastTap = null;
    }
    this.callbacks.onDrag(dx, dy);
  }

  pointerUp(id: number, x: number, y: number, time: number): void {
    const pointer = this.pointers.get(id);
    this.pointers.delete(id);
    if (!pointer) return;

    // When a pinch ends, the finger left on screen must not "jump" or count as a tap.
    // It must travel the normal drag threshold again before it moves the view.
    for (const remaining of this.pointers.values()) {
      remaining.disqualified = true;
      remaining.dragging = false;
      remaining.startX = remaining.lastX;
      remaining.startY = remaining.lastY;
    }

    const wasTap = !pointer.disqualified && time - pointer.startTime <= TAP_MAX_MS;
    if (!wasTap) return;

    const previous = this.lastTap;
    const isDouble =
      previous !== null &&
      time - previous.time <= DOUBLE_TAP_MAX_MS &&
      Math.hypot(x - previous.x, y - previous.y) <= DOUBLE_TAP_MAX_DIST_PX;

    if (isDouble) {
      this.lastTap = null; // a third tap starts a new sequence
      this.callbacks.onDoubleTap(x, y);
    } else {
      this.lastTap = { x, y, time };
      this.callbacks.onTap(x, y);
    }
  }

  /** Call when the browser cancels a touch (e.g. an incoming call). */
  pointerCancel(id: number): void {
    this.pointers.delete(id);
    this.lastTap = null;
  }
}

// Connects the browser's pointer / wheel / keyboard events to the game.
// Every gesture has a keyboard alternative (spec rule: "Every gesture has a keyboard or button alternative").
import { GestureClassifier, type GestureCallbacks } from './gestures';

export interface InputCallbacks extends GestureCallbacks {
  onWheelZoom(factor: number): void;
  onKeyZoom(factor: number): void;
  /** Arrow keys, expressed as an equivalent drag in pixels. */
  onKeyRotate(dx: number, dy: number): void;
  onFocusKey(): void;
  onEscapeKey(): void;
}

const KEY_ROTATE_PX = 30;

export function attachInput(element: HTMLElement, callbacks: InputCallbacks): () => void {
  const gestures = new GestureClassifier(callbacks);
  // Pointer coordinates relative to the element (not the page), for picking.
  const local = (e: PointerEvent): [number, number] => {
    const rect = element.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onDown = (e: PointerEvent): void => {
    element.setPointerCapture(e.pointerId); // keep receiving moves even if the finger leaves the canvas
    element.focus({ preventScroll: true }); // so the keyboard controls work after a click
    const [x, y] = local(e);
    gestures.pointerDown(e.pointerId, x, y, e.timeStamp);
  };
  const onMove = (e: PointerEvent): void => {
    const [x, y] = local(e);
    gestures.pointerMove(e.pointerId, x, y);
  };
  const onUp = (e: PointerEvent): void => {
    const [x, y] = local(e);
    gestures.pointerUp(e.pointerId, x, y, e.timeStamp);
  };
  const onCancel = (e: PointerEvent): void => gestures.pointerCancel(e.pointerId);

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault(); // stop the page from scrolling/zooming while the pointer is over the game
    callbacks.onWheelZoom(Math.exp(e.deltaY * 0.001));
  };

  const onKey = (e: KeyboardEvent): void => {
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        callbacks.onKeyRotate(-KEY_ROTATE_PX, 0);
        break;
      case 'ArrowRight':
        callbacks.onKeyRotate(KEY_ROTATE_PX, 0);
        break;
      case 'ArrowUp':
        callbacks.onKeyRotate(0, -KEY_ROTATE_PX);
        break;
      case 'ArrowDown':
        callbacks.onKeyRotate(0, KEY_ROTATE_PX);
        break;
      case '+':
      case '=':
        callbacks.onKeyZoom(0.8);
        break;
      case '-':
      case '_':
        callbacks.onKeyZoom(1.25);
        break;
      case 'Enter':
        callbacks.onFocusKey();
        break;
      case 'Escape':
        callbacks.onEscapeKey();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onCancel);
  element.addEventListener('wheel', onWheel, { passive: false }); // passive:false is needed to call preventDefault
  element.addEventListener('keydown', onKey);

  return () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onCancel);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('keydown', onKey);
  };
}

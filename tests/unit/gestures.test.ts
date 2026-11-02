import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureClassifier } from '../../src/engine/gestures';

// A fake set of callbacks lets us see exactly which gestures fired.
function setup() {
  const cb = { onDrag: vi.fn(), onPinch: vi.fn(), onTap: vi.fn(), onDoubleTap: vi.fn() };
  return { cb, g: new GestureClassifier(cb) };
}

describe('GestureClassifier', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it('a quick still touch is a tap', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerUp(1, 100, 100, 100);
    expect(s.cb.onTap).toHaveBeenCalledWith(100, 100);
  });
  it('small finger wobble is still a tap and not a drag', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerMove(1, 104, 103);
    s.g.pointerUp(1, 104, 103, 100);
    expect(s.cb.onDrag).not.toHaveBeenCalled();
    expect(s.cb.onTap).toHaveBeenCalledTimes(1);
  });
  it('a long press is not a tap', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerUp(1, 100, 100, 600);
    expect(s.cb.onTap).not.toHaveBeenCalled();
  });
  it('moving far makes a drag with incremental deltas, and no tap', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerMove(1, 130, 100); // passes the threshold: first delta is 30
    s.g.pointerMove(1, 140, 95); // next delta is (10, -5)
    s.g.pointerUp(1, 140, 95, 100);
    expect(s.cb.onDrag).toHaveBeenNthCalledWith(1, 30, 0);
    expect(s.cb.onDrag).toHaveBeenNthCalledWith(2, 10, -5);
    expect(s.cb.onTap).not.toHaveBeenCalled();
  });
  it('two quick nearby taps make a tap then a double tap', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerUp(1, 100, 100, 50);
    s.g.pointerDown(1, 105, 102, 200);
    s.g.pointerUp(1, 105, 102, 250);
    expect(s.cb.onTap).toHaveBeenCalledTimes(1);
    expect(s.cb.onDoubleTap).toHaveBeenCalledTimes(1);
  });
  it('two taps too far apart are two separate taps', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerUp(1, 100, 100, 50);
    s.g.pointerDown(1, 300, 300, 200);
    s.g.pointerUp(1, 300, 300, 250);
    expect(s.cb.onTap).toHaveBeenCalledTimes(2);
    expect(s.cb.onDoubleTap).not.toHaveBeenCalled();
  });
  it('two taps too slow are two separate taps', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerUp(1, 100, 100, 50);
    s.g.pointerDown(1, 100, 100, 900);
    s.g.pointerUp(1, 100, 100, 950);
    expect(s.cb.onDoubleTap).not.toHaveBeenCalled();
  });
  it('a third quick tap starts a fresh sequence, not another double tap', () => {
    for (const t of [0, 200, 400]) {
      s.g.pointerDown(1, 100, 100, t);
      s.g.pointerUp(1, 100, 100, t + 40);
    }
    expect(s.cb.onDoubleTap).toHaveBeenCalledTimes(1);
    expect(s.cb.onTap).toHaveBeenCalledTimes(2);
  });
  it('two fingers pinch: apart gives ratio > 1, and neither lift is a tap', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerDown(2, 200, 100, 0);
    s.g.pointerMove(2, 300, 100); // distance 100 -> 200
    expect(s.cb.onPinch).toHaveBeenCalledWith(2);
    s.g.pointerUp(2, 300, 100, 50);
    s.g.pointerUp(1, 100, 100, 60);
    expect(s.cb.onTap).not.toHaveBeenCalled();
  });
  it('the finger left after a pinch does not drag or jump', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerDown(2, 200, 100, 0);
    s.g.pointerUp(2, 200, 100, 50);
    s.g.pointerMove(1, 103, 100); // tiny move after the pinch
    expect(s.cb.onDrag).not.toHaveBeenCalled();
  });
  it('a cancelled touch does nothing', () => {
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerCancel(1);
    s.g.pointerUp(1, 100, 100, 50);
    expect(s.cb.onTap).not.toHaveBeenCalled();
  });
});

describe('GestureClassifier after a pinch', () => {
  it('the leftover finger drags again once it moves past the threshold', () => {
    const s = setup();
    s.g.pointerDown(1, 100, 100, 0);
    s.g.pointerDown(2, 200, 100, 0);
    s.g.pointerUp(2, 200, 100, 50);
    s.g.pointerMove(1, 130, 100);
    expect(s.cb.onDrag).toHaveBeenCalledWith(30, 0);
  });
});

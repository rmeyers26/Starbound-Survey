// Decides what a vertical swipe on the bottom-sheet handle means (pure, so it is unit tested).
// Spec: "Info panel handle: drag the bottom sheet up for Advanced data".

export type SheetAction = 'expand' | 'collapse' | 'toggle';

const SWIPE_MIN_PX = 30; // a swipe must travel at least this far
const TAP_MAX_PX = 10; // moving less than this counts as a tap

/** `dy` is finger movement in pixels: negative = swiped UP, positive = swiped DOWN. */
export function sheetAction(dy: number): SheetAction | null {
  if (dy <= -SWIPE_MIN_PX) return 'expand';
  if (dy >= SWIPE_MIN_PX) return 'collapse';
  if (Math.abs(dy) <= TAP_MAX_PX) return 'toggle';
  return null; // an in-between wobble does nothing
}

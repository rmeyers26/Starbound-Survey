// Runs a scan live: starts and stops it, fills the ring, checks the rules every frame, and applies
// the result. The rules themselves are in scanner.ts / scoring.ts (pure, unit tested); this file is
// the glue that needs a clock and animation frames, so those are passed in and can be faked in tests.
import { log } from '../engine/log';
import { VISUALS, scanRange } from '../engine/scale';
import type { SaveRecord } from '../save/schema';
import type { EventBus, GameEvents } from './events';
import { DEFAULT_SCAN_SECONDS, ScanSession, checkScan } from './scanner';
import { applyScan } from './scoring';
import type { Settings } from './settings';
import type { GameStateMachine } from './stateMachine';
import type { CelestialObject } from './types';

export interface ScanControllerDeps {
  bus: EventBus<GameEvents>;
  machine: GameStateMachine;
  objects: CelestialObject[];
  getRecord(): SaveRecord;
  /** Applies a change to the save (runs the function immediately, then stores it). */
  commit(change: (record: SaveRecord) => SaveRecord): Promise<void>;
  getSelectedId(): string | null;
  getDistance(id: string): number | null;
  getSettings(): Settings;
  /** True in practice mode: scans reveal data but award no XP. */
  isPractice?(): boolean;
  scanSeconds?: number;
  now?: () => number;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface ScanController {
  isScanning(): boolean;
  dispose(): void;
}

export function createScanController(deps: ScanControllerDeps): ScanController {
  const { bus, machine, objects } = deps;
  const now = deps.now ?? (() => performance.now());
  const requestFrame = deps.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = deps.cancelFrame ?? ((h) => cancelAnimationFrame(h));
  const duration = deps.scanSeconds ?? DEFAULT_SCAN_SECONDS;

  let session: ScanSession | null = null;
  let target: { id: string; tier: number } | null = null;
  let frameHandle = 0;

  const objectOf = (id: string | null): CelestialObject | undefined =>
    objects.find((o) => o.id === id);
  const rangeOf = (id: string): number => scanRange(VISUALS[id]?.radius ?? 1);

  function check(id: string | null) {
    return checkScan({
      state: machine.state,
      object: objectOf(id),
      record: deps.getRecord(),
      distance: id ? deps.getDistance(id) : null,
      range: id ? rangeOf(id) : 0,
    });
  }

  function stopLoop(): void {
    cancelFrame(frameHandle);
    session = null;
    target = null;
  }

  function cancel(reason?: 'too-far' | 'not-exploring'): void {
    if (!session || !target) return;
    const { id } = target;
    stopLoop();
    bus.emit('scan:cancelled', { id });
    if (reason) bus.emit('scan:blocked', { reason });
  }

  function start(): void {
    if (session) {
      // In tap mode, tapping again while scanning cancels (a toggle). In hold mode a second start
      // cannot happen because the first press is still down.
      if (deps.getSettings().scanMode === 'tap') cancel();
      return;
    }
    const id = deps.getSelectedId();
    const result = check(id);
    if (!result.ok) {
      bus.emit('scan:blocked', { reason: result.reason });
      return;
    }
    session = new ScanSession(duration);
    session.start(now());
    target = { id: id as string, tier: result.tier };
    bus.emit('scan:progress', { id: id as string, progress: 0 });
    frameHandle = requestFrame(tick);
  }

  function tick(): void {
    if (!session || !target) return;
    // The rules can stop being true mid-scan: the player moved away, opened a screen, or picked
    // something else. Check every frame so the scan never completes on a stale situation.
    if (machine.state !== 'EXPLORE') return cancel('not-exploring');
    if (deps.getSelectedId() !== target.id) return cancel();
    const distance = deps.getDistance(target.id);
    if (distance === null || distance > rangeOf(target.id)) return cancel('too-far');

    const progress = session.progress(now());
    bus.emit('scan:progress', { id: target.id, progress });
    if (progress >= 1) return finish();
    frameHandle = requestFrame(tick);
  }

  function finish(): void {
    if (!target) return;
    const { id, tier } = target;
    stopLoop();

    // `commit` runs our function right away with the latest record, so `outcome` is set on return.
    let outcome: ReturnType<typeof applyScan> | null = null;
    deps
      .commit((record) => {
        outcome = applyScan(record, id, tier, !deps.isPractice?.());
        return outcome.record;
      })
      .catch((error) => log('Saving the scan failed', error));
    if (!outcome) return;
    const done = outcome as ReturnType<typeof applyScan>;

    bus.emit('scan:completed', { id, tier, xpAwarded: done.xpAwarded });
    if (done.xpAwarded > 0) {
      bus.emit('xp:changed', { xp: done.record.xp, delta: done.xpAwarded, rank: done.record.rank });
    }
    if (done.rankedUpTo)
      bus.emit('rank:up', { rank: done.rankedUpTo, newRegions: done.newRegions });
    bus.emit('progress:changed', { record: deps.getRecord() });
  }

  const offRequest = bus.on('scan:request', ({ action }) => {
    if (action === 'start') start();
    // In hold mode, letting go before the ring fills cancels the scan. In tap mode releasing does nothing.
    else if (deps.getSettings().scanMode === 'hold') cancel();
  });

  // A scan must not keep running in a background tab.
  const onHidden = (): void => {
    if (typeof document !== 'undefined' && document.hidden) cancel();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHidden);

  return {
    isScanning: () => session !== null,
    dispose() {
      offRequest();
      stopLoop();
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onHidden);
    },
  };
}

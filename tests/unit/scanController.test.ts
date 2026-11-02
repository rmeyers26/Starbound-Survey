import { describe, it, expect, vi } from 'vitest';
import realData from '../../data/objects.json';
import { EventBus, type GameEvents } from '../../src/game/events';
import { createScanController } from '../../src/game/scanController';
import { defaultSettings, type Settings } from '../../src/game/settings';
import { GameStateMachine } from '../../src/game/stateMachine';
import { validateObjects } from '../../src/game/validateObjects';
import { createEmptySave, type SaveRecord } from '../../src/save/schema';

const objects = validateObjects(realData);

/** Builds a controller with a fake clock and fake animation frames, so a 3 s scan runs instantly. */
function setup(overrides: { settings?: Partial<Settings>; record?: Partial<SaveRecord> } = {}) {
  const bus = new EventBus<GameEvents>();
  const machine = new GameStateMachine(bus);
  machine.transition('TITLE');
  machine.transition('EXPLORE');

  let record: SaveRecord = { ...createEmptySave(), ...overrides.record };
  let selected: string | null = 'moon';
  let distance: number | null = 4; // at the Moon's focus distance
  let clock = 0;
  let pending: (() => void) | null = null;
  const settings = { ...defaultSettings(false), ...overrides.settings };

  const events: Array<[string, unknown]> = [];
  for (const name of [
    'scan:progress',
    'scan:completed',
    'scan:cancelled',
    'scan:blocked',
    'xp:changed',
    'rank:up',
    'progress:changed',
  ] as const) {
    bus.on(name, (payload) => events.push([name, payload]));
  }
  const names = () => events.map(([n]) => n);

  const controller = createScanController({
    bus,
    machine,
    objects,
    getRecord: () => record,
    commit: async (change) => {
      record = change(record);
    },
    getSelectedId: () => selected,
    getDistance: () => distance,
    getSettings: () => settings,
    scanSeconds: 3,
    now: () => clock,
    requestFrame: (cb) => {
      pending = cb;
      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
  });

  return {
    bus,
    machine,
    controller,
    events,
    names,
    record: () => record,
    setSelected: (id: string | null) => (selected = id),
    setDistance: (d: number | null) => (distance = d),
    press: () => bus.emit('scan:request', { action: 'start' }),
    release: () => bus.emit('scan:request', { action: 'stop' }),
    /** Move the clock forward and run the next animation frame, like a browser would. */
    advance: (ms: number) => {
      clock += ms;
      const run = pending;
      pending = null;
      run?.();
    },
  };
}

describe('scan controller: a normal hold scan', () => {
  it('fills over 3 seconds, then awards 20 XP and records the scan', () => {
    const t = setup();
    t.press();
    t.advance(1500);
    const mid = t.events.filter(([n]) => n === 'scan:progress').at(-1)![1] as { progress: number };
    expect(mid.progress).toBeCloseTo(0.5);
    expect(t.names()).not.toContain('scan:completed');

    t.advance(1500);
    expect(t.names()).toContain('scan:completed');
    expect(t.record().xp).toBe(20);
    expect(t.record().scannedObjects).toEqual({ moon: 1 });
    expect(t.events.find(([n]) => n === 'xp:changed')![1]).toEqual({
      xp: 20,
      delta: 20,
      rank: 'Cadet',
    });
    expect(t.controller.isScanning()).toBe(false);
  });
  it('does not finish a moment early', () => {
    const t = setup();
    t.press();
    t.advance(2999);
    expect(t.names()).not.toContain('scan:completed');
    t.advance(1);
    expect(t.names()).toContain('scan:completed');
  });
});

describe('scan controller: cancelling', () => {
  it('letting go early cancels with no reward (hold mode)', () => {
    const t = setup();
    t.press();
    t.advance(1000);
    t.release();
    expect(t.names()).toContain('scan:cancelled');
    expect(t.record().xp).toBe(0);
    t.advance(5000); // nothing is running any more
    expect(t.names()).not.toContain('scan:completed');
  });
  it('moving out of range mid-scan cancels and says "too far"', () => {
    const t = setup();
    t.press();
    t.advance(500);
    t.setDistance(100);
    t.advance(500);
    expect(t.names()).toContain('scan:cancelled');
    expect(t.events.find(([n]) => n === 'scan:blocked')![1]).toEqual({ reason: 'too-far' });
    expect(t.record().xp).toBe(0);
  });
  it('selecting something else mid-scan cancels', () => {
    const t = setup();
    t.press();
    t.advance(500);
    t.setSelected('earth');
    t.advance(500);
    expect(t.names()).toContain('scan:cancelled');
    expect(t.record().xp).toBe(0);
  });
  it('opening a screen mid-scan cancels (the state machine guards it)', () => {
    const t = setup();
    t.press();
    t.advance(500);
    t.machine.transition('LOGBOOK');
    t.advance(500);
    expect(t.names()).toContain('scan:cancelled');
    expect(t.events.find(([n]) => n === 'scan:blocked')![1]).toEqual({ reason: 'not-exploring' });
  });
});

describe('scan controller: refusing to start', () => {
  it('with nothing selected', () => {
    const t = setup();
    t.setSelected(null);
    t.press();
    expect(t.events.find(([n]) => n === 'scan:blocked')![1]).toEqual({ reason: 'no-selection' });
    expect(t.controller.isScanning()).toBe(false);
  });
  it('when too far away', () => {
    const t = setup();
    t.setDistance(150);
    t.press();
    expect(t.events.find(([n]) => n === 'scan:blocked')![1]).toEqual({ reason: 'too-far' });
  });
  it('while a screen is open', () => {
    const t = setup();
    t.machine.transition('LOGBOOK');
    t.press();
    expect(t.events.find(([n]) => n === 'scan:blocked')![1]).toEqual({ reason: 'not-exploring' });
  });
  it('when the object is already fully scanned for this scanner level (no XP farming)', () => {
    const t = setup({ record: { scannedObjects: { moon: 1 }, xp: 20 } });
    t.press();
    expect(t.events.find(([n]) => n === 'scan:blocked')![1]).toEqual({ reason: 'complete' });
    expect(t.record().xp).toBe(20);
  });
});

describe('scan controller: progression', () => {
  it('a higher rank can scan deeper, for 10 XP', () => {
    const t = setup({ record: { rank: 'Navigator', xp: 200, scannedObjects: { moon: 1 } } });
    t.press();
    t.advance(3000);
    expect(t.record().scannedObjects.moon).toBe(2);
    expect(t.record().xp).toBe(210);
  });
  it('announces a rank-up when a scan crosses the threshold', () => {
    const t = setup({ record: { xp: 190 } });
    t.press();
    t.advance(3000);
    expect(t.record().rank).toBe('Navigator');
    expect(t.events.find(([n]) => n === 'rank:up')![1]).toEqual({
      rank: 'Navigator',
      newRegions: ['outer'],
    });
  });
  it('tells listeners the save changed', () => {
    const t = setup();
    t.press();
    t.advance(3000);
    expect(t.names()).toContain('progress:changed');
  });
});

describe('scan controller: tap mode (no holding needed)', () => {
  it('releasing does not cancel', () => {
    const t = setup({ settings: { scanMode: 'tap' } });
    t.press();
    t.release();
    t.advance(3000);
    expect(t.names()).toContain('scan:completed');
  });
  it('tapping again while scanning cancels', () => {
    const t = setup({ settings: { scanMode: 'tap' } });
    t.press();
    t.release();
    t.advance(1000);
    t.press();
    expect(t.names()).toContain('scan:cancelled');
    expect(t.controller.isScanning()).toBe(false);
  });
});

describe('scan controller: housekeeping', () => {
  it('dispose stops listening', () => {
    const t = setup();
    t.controller.dispose();
    const spy = vi.fn();
    t.bus.on('scan:blocked', spy);
    t.press();
    expect(t.names()).not.toContain('scan:progress');
  });
});

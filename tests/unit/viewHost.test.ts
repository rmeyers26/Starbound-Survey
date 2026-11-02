import { describe, it, expect, vi } from 'vitest';
import { ViewHost, readRendererOverride, type ViewFactories } from '../../src/engine/viewHost';
import type { View, ViewKind, ViewOptions, ViewState } from '../../src/engine/view';
import { EventBus, type GameEvents } from '../../src/game/events';

const quality = {
  pixelRatioCap: 2,
  resolutionScale: 1,
  starCount: 100,
  textureSize: 1024 as const,
};
const sampleState: ViewState = {
  selectedId: 'moon',
  focusId: 'earth',
  simDays: 42,
  camera: { yaw: 1, pitch: 0.2, distance: 30 },
};

/** A pretend renderer that records what happens to it. */
function fakeView(kind: ViewKind, options: ViewOptions) {
  return {
    kind,
    options,
    start: vi.fn(),
    dispose: vi.fn(),
    setQuality: vi.fn(),
    setControlSettings: vi.fn(),
    getState: vi.fn(() => sampleState),
    distanceTo: vi.fn(() => 5),
  };
}
type Fake = ReturnType<typeof fakeView>;

function setup(opts: { webglThrows?: boolean; forceCanvas?: boolean } = {}) {
  const views: Fake[] = [];
  const factories: ViewFactories = {
    createWebGL: (o) => {
      if (opts.webglThrows) throw new Error('no webgl');
      const v = fakeView('webgl2', o);
      views.push(v);
      return v as View;
    },
    createCanvas: (o) => {
      const v = fakeView('canvas2d', o);
      views.push(v);
      return v as View;
    },
  };
  const changes: Array<[ViewKind, string]> = [];
  const host = new ViewHost({
    host: {} as HTMLElement,
    objects: [],
    bus: new EventBus<GameEvents>(),
    getQuality: () => quality,
    onRendererChanged: (kind, reason) => changes.push([kind, reason]),
    forceCanvas: opts.forceCanvas,
    factories,
  });
  return { host, views, changes };
}

describe('ViewHost fallback chain', () => {
  it('uses WebGL when it works', () => {
    const { host, changes } = setup();
    expect(host.kind).toBe('webgl2');
    expect(changes).toEqual([['webgl2', 'initial']]);
  });
  it('falls back to Canvas 2D when WebGL throws', () => {
    const { host, changes } = setup({ webglThrows: true });
    expect(host.kind).toBe('canvas2d');
    expect(changes).toEqual([['canvas2d', 'fallback']]);
  });
  it('goes straight to Canvas 2D when forced, without trying WebGL', () => {
    const { host, changes } = setup({ forceCanvas: true });
    expect(host.kind).toBe('canvas2d');
    expect(changes).toEqual([['canvas2d', 'forced']]);
  });
});

describe('ViewHost GPU loss', () => {
  it('rebuilds WebGL once, restoring the old state and settings', () => {
    const { host, views, changes } = setup();
    host.setControlSettings({ rotateSensitivity: 2, zoomSensitivity: 1, reducedMotion: true });
    host.start();
    views[0].options.onContextLost!();

    expect(views[0].dispose).toHaveBeenCalled();
    expect(views).toHaveLength(2);
    expect(views[1].kind).toBe('webgl2');
    expect(views[1].options.initialState).toEqual(sampleState); // camera and scene restored
    expect(views[1].setControlSettings).toHaveBeenCalledWith(
      expect.objectContaining({ rotateSensitivity: 2 }),
    );
    expect(views[1].start).toHaveBeenCalled();
    expect(changes.at(-1)).toEqual(['webgl2', 'recovered']);
  });
  it('falls back to Canvas 2D on the second loss', () => {
    const { host, views, changes } = setup();
    host.start();
    views[0].options.onContextLost!();
    views[1].options.onContextLost!();
    expect(host.kind).toBe('canvas2d');
    expect(views[2].options.initialState).toEqual(sampleState);
    expect(changes.at(-1)).toEqual(['canvas2d', 'fallback']);
  });
  it('ignores a loss after dispose', () => {
    const { host, views } = setup();
    host.dispose();
    views[0].options.onContextLost!();
    expect(views).toHaveLength(1);
  });
  it('does not start a rebuilt view if the host was never started', () => {
    const { views } = setup();
    views[0].options.onContextLost!();
    expect(views[1].start).not.toHaveBeenCalled();
  });
});

describe('readRendererOverride', () => {
  it('reads the testing override', () => {
    expect(readRendererOverride('?renderer=canvas2d')).toBe('canvas2d');
    expect(readRendererOverride('?renderer=webgl2')).toBe('webgl2');
    expect(readRendererOverride('?renderer=bogus')).toBeNull();
    expect(readRendererOverride('')).toBeNull();
  });
});

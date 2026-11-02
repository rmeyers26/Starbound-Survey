import { describe, it, expect, vi } from 'vitest';
import { EventBus, type GameEvents } from '../../src/game/events';

describe('EventBus', () => {
  it('delivers payloads to listeners', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('object:selected', fn);
    bus.emit('object:selected', { id: 'moon' });
    expect(fn).toHaveBeenCalledWith({ id: 'moon' });
  });
  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    const off = bus.on('camera:zoom', fn);
    off();
    bus.emit('camera:zoom', { factor: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
  it('keeps going when one listener throws', () => {
    const bus = new EventBus<GameEvents>();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    bus.on('camera:focus', () => {
      throw new Error('boom');
    });
    bus.on('camera:focus', good);
    bus.emit('camera:focus', { id: null });
    expect(good).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

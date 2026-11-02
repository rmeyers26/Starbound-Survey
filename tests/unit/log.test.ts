import { describe, it, expect, vi } from 'vitest';
import { log } from '../../src/engine/log';

describe('log', () => {
  it('prints to the console in dev/test mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log('hello');
    expect(spy).toHaveBeenCalledWith('[Starbound]', 'hello');
    spy.mockRestore();
  });
});

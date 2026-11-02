import { describe, it, expect, vi } from 'vitest';
import { createUpdateChecker } from '../../src/updateChecker';

describe('createUpdateChecker', () => {
  it('checks, but not again within the minimum gap', async () => {
    let t = 0;
    const registration = { update: vi.fn().mockResolvedValue(undefined) };
    const check = createUpdateChecker(registration, {
      minGapMs: 1000,
      now: () => t,
      isOnline: () => true,
    });
    expect(await check()).toBe(true);
    t = 500;
    expect(await check()).toBe(false);
    t = 1500;
    expect(await check()).toBe(true);
    expect(registration.update).toHaveBeenCalledTimes(2);
  });
  it('does nothing while offline, and does not use up the gap', async () => {
    let online = false;
    const registration = { update: vi.fn().mockResolvedValue(undefined) };
    const check = createUpdateChecker(registration, {
      minGapMs: 1000,
      now: () => 0,
      isOnline: () => online,
    });
    expect(await check()).toBe(false);
    online = true;
    expect(await check()).toBe(true);
  });
  it('survives a failing update', async () => {
    const registration = { update: vi.fn().mockRejectedValue(new Error('network')) };
    const check = createUpdateChecker(registration, { minGapMs: 0, isOnline: () => true });
    await expect(check()).resolves.toBe(true);
  });
});

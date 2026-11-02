import { describe, it, expect } from 'vitest';
import {
  isIosDevice,
  shouldShowInstallHint,
  type InstallEnvironment,
} from '../../src/ui/installHint';

const iphone: InstallEnvironment = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  platform: 'iPhone',
  maxTouchPoints: 5,
  standalone: false,
  alreadyShown: false,
};

describe('isIosDevice', () => {
  it('recognises iPhone and iPad user agents', () => {
    expect(isIosDevice(iphone)).toBe(true);
    expect(isIosDevice({ ...iphone, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0)' })).toBe(true);
  });
  it('recognises a newer iPad that pretends to be a Mac', () => {
    expect(
      isIosDevice({
        userAgent: 'Mozilla/5.0 (Macintosh)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });
  it('does not mistake a real Mac or Android phone for iOS', () => {
    expect(
      isIosDevice({
        userAgent: 'Mozilla/5.0 (Macintosh)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
    expect(
      isIosDevice({
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });
});

describe('shouldShowInstallHint', () => {
  it('shows on iOS in the browser the first time', () => {
    expect(shouldShowInstallHint(iphone)).toBe(true);
  });
  it('does not show once installed, once shown, or on other platforms', () => {
    expect(shouldShowInstallHint({ ...iphone, standalone: true })).toBe(false);
    expect(shouldShowInstallHint({ ...iphone, alreadyShown: true })).toBe(false);
    expect(
      shouldShowInstallHint({
        ...iphone,
        userAgent: 'Android',
        platform: 'Linux',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});

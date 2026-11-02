import { expect, test } from '@playwright/test';
import { chip, openGame } from './helpers';

// A browser that REALLY has no WebGL (not just a forced override). These flags are Chromium-specific,
// and `launchOptions` must be set at the top of a file because it needs its own browser process.
test.skip(({ browserName }) => browserName !== 'chromium', 'launch flags are Chromium-specific');
test.use({ launchOptions: { args: ['--disable-3d-apis', '--disable-gpu'] } });

test('with WebGL disabled the game switches to the 2D chart and says so', async ({ page }) => {
  await openGame(page);
  expect(await page.evaluate(() => !document.createElement('canvas').getContext('webgl2'))).toBe(
    true,
  );
  await expect(page.getByText('3D graphics are not available')).toBeVisible();
  await chip(page, 'moon').click();
  await expect(page.locator('.info-title')).toHaveText('The Moon');
});

import { expect, test } from '@playwright/test';
import { openGame, chip } from './helpers';

// Spec gate: "installable PWA" and "the game still playable offline after one online visit".
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'service-worker/offline emulation is Chromium-only here',
);

test('the web app manifest is complete and its icons exist', async ({ page, request }) => {
  await openGame(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: 'Starbound Survey',
    display: 'standalone',
    start_url: '/',
  });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test('after one visit the game loads and works with no network', async ({ page, context }) => {
  await openGame(page);
  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await page.reload();
  await openGame(page); // canvas + data (objects.json) came from the cache
  await chip(page, 'moon').click();
  await expect(page.locator('.info-title')).toHaveText('The Moon');
});

test('a notification never covers the SCAN button', async ({ page }) => {
  await openGame(page);
  // "Ready to play offline" is the notification every first-time visitor sees.
  await expect(page.locator('.toast')).toBeVisible({ timeout: 30_000 });
  const covered = await page.locator('.scan-button').evaluate((button) => {
    const r = button.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !(top === button || button.contains(top));
  });
  expect(covered).toBe(false);
});

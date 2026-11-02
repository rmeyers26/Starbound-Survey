import { expect, type Page } from '@playwright/test';

/** Collects uncaught page errors and console errors so a test can assert there were none. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** Opens the game and waits until the canvas and object buttons exist. */
export async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('canvas.game-canvas')).toBeVisible();
  await expect(page.locator('.hud-objects button')).toHaveCount(3);
}

export const chip = (page: Page, id: 'sun' | 'earth' | 'moon') =>
  page.locator(`button[data-object-id="${id}"]`);

export const openSettings = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.locator('dialog.settings-dialog')).toBeVisible();
};

/**
 * Opens the game set up for quick, reliable scanning tests:
 *  - "reduce motion" makes camera flights instant, so the ship is in range right away;
 *  - ?scanSeconds makes a scan take a fraction of a second instead of 3.
 * Extra query options (e.g. "renderer=canvas2d") can be added.
 */
export async function openForScanning(
  page: Page,
  scanSeconds = 0.3,
  extraQuery = '',
): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGame(page, `?scanSeconds=${scanSeconds}${extraQuery ? `&${extraQuery}` : ''}`);
}

/** Presses the SCAN button with the mouse for `ms` milliseconds, then lets go. */
export async function holdScan(page: Page, ms: number): Promise<void> {
  const box = (await page.locator('.scan-button').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Flies to an object and scans it. Retries briefly because the first frame after a flight may still be "too far". */
export async function scanObject(page: Page, id: 'sun' | 'earth' | 'moon'): Promise<void> {
  await chip(page, id).click();
  for (let attempt = 0; attempt < 8; attempt++) {
    await holdScan(page, 900);
    const text = (await page.locator('.scan-status').textContent()) ?? '';
    if (/complete|Nothing new/.test(text)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`Could not scan ${id}`);
}

export const xpText = (page: Page) => page.locator('.xp-text');

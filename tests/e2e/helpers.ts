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

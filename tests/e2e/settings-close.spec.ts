// The Settings window has a Close button at the TOP (pinned, so it stays in reach however far the list is scrolled),
// as well as the one at the bottom.
import { expect, test } from '@playwright/test';
import { openGame, openSettings } from './helpers';

test.describe('Settings: Close button on top', () => {
  test('is at the top of the window, and closes it', async ({ page }) => {
    await openGame(page);
    await openSettings(page);
    const dialog = page.locator('dialog.settings-dialog');
    const top = dialog.getByRole('button', { name: 'Close settings' });
    await expect(top).toBeVisible();
    const dialogBox = (await dialog.boundingBox())!;
    const buttonBox = (await top.boundingBox())!;
    // Near the top edge of the window (within the first 80 px), and finger-sized (at least 44 px).
    expect(buttonBox.y - dialogBox.y).toBeLessThan(80);
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    await top.click();
    await expect(dialog).toBeHidden();
  });

  test('stays in reach when the settings are scrolled right down (pinned to the top)', async ({
    page,
  }) => {
    // A short screen makes the list scroll, as on a small phone.
    await page.setViewportSize({ width: 390, height: 420 });
    await openGame(page);
    await openSettings(page);
    const dialog = page.locator('dialog.settings-dialog');
    await dialog.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(50); // it really did scroll
    const top = dialog.getByRole('button', { name: 'Close settings' });
    await expect(top).toBeInViewport();
    await top.click();
    await expect(dialog).toBeHidden();
  });

  test('the Close button at the bottom still works too, and Escape closes it', async ({ page }) => {
    await openGame(page);
    await openSettings(page);
    const dialog = page.locator('dialog.settings-dialog');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('has no accessibility violations with both Close buttons', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    await openGame(page);
    await openSettings(page);
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

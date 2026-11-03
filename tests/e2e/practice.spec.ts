// Practice mode: everything unlocked, every scan level available, no XP, and your real progress untouched.
import { expect, test } from '@playwright/test';
import { chip, openForScanning, openSettings, scanObject, setPractice, xpText } from './helpers';

test.describe('practice mode', () => {
  test('unlocks everything, gives no XP, and leaves real progress alone', async ({ page }) => {
    await openForScanning(page);
    await expect(chip(page, 'jupiter')).toHaveAttribute('aria-disabled', 'true'); // a new Cadet cannot reach it
    await expect(xpText(page)).toHaveText('0 / 200 XP');

    await setPractice(page, true);
    await expect(page.getByText('Practice mode on: everything is unlocked')).toBeVisible();
    await expect(page.locator('.xp-rank')).toHaveText('Practice');
    await expect(xpText(page)).toHaveText('Everything unlocked, no XP');
    await expect(chip(page, 'jupiter')).toHaveAttribute('aria-disabled', 'false'); // unlocked, no XP needed

    // Scan Jupiter three times: a real Cadet could only do the first tier, practice can do all three.
    await scanObject(page, 'jupiter');
    await expect(page.locator('.scan-status')).toContainText('Practice scan: no XP.');
    await scanObject(page, 'jupiter');
    await scanObject(page, 'jupiter');
    await page.getByRole('tab', { name: 'Advanced data' }).click();
    await expect(page.locator('.data-row dt')).toContainText(['Temperature at the 1-bar level']); // the deepest tier
    await expect(xpText(page)).toHaveText('Everything unlocked, no XP'); // nothing was earned

    // Switching practice off puts everything back exactly as it was.
    await setPractice(page, false);
    await expect(page.getByText('Practice mode off: back to your real progress.')).toBeVisible();
    await expect(page.locator('.xp-rank')).toHaveText('Cadet');
    await expect(xpText(page)).toHaveText('0 / 200 XP'); // no XP was gained
    await expect(chip(page, 'jupiter')).toHaveAttribute('aria-disabled', 'true'); // locked again
  });

  test('practice scans are not saved, but the setting is remembered after a reload', async ({
    page,
  }) => {
    await openForScanning(page);
    await setPractice(page, true);
    await scanObject(page, 'moon');
    await page.getByRole('button', { name: /Open the Logbook/ }).click();
    const logbook = page.locator('dialog.logbook-dialog');
    await expect(logbook.getByText('Discovered 1 of 31 objects.')).toBeVisible(); // everything counts in practice
    await page.keyboard.press('Escape');

    await page.waitForTimeout(300);
    await page.reload();
    await openForScanning(page);
    // The setting stays on after a reload ...
    await expect(page.locator('.xp-rank')).toHaveText('Practice');
    // ... but the practice scan was not saved.
    await page.getByRole('button', { name: /Open the Logbook/ }).click();
    await expect(logbook.getByText('Discovered 0 of 31 objects.')).toBeVisible();
    await page.keyboard.press('Escape');

    // Turn it off: the real save has no scans and no XP, and "objects inspected" never counted the practice taps.
    await setPractice(page, false);
    await expect(xpText(page)).toHaveText('0 / 200 XP');
    await openSettings(page);
    await expect(page.locator('#progress-summary')).toHaveText('Objects inspected: 0 of 10');
  });
});

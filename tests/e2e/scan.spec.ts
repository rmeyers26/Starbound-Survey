import { expect, test } from '@playwright/test';
import {
  chip,
  holdScan,
  openForScanning,
  openGame,
  openSettings,
  scanObject,
  trackErrors,
  xpText,
} from './helpers';

// The core loop from the spec: select, fly close, hold SCAN, learn, earn XP, fill the Logbook.

test.describe('scanning', () => {
  test('a full scan awards 20 XP, reveals basic data, and shows a message', async ({ page }) => {
    const errors = trackErrors(page);
    await openForScanning(page);
    await expect(xpText(page)).toHaveText('0 / 200 XP');
    await scanObject(page, 'moon');
    await expect(xpText(page)).toHaveText('20 / 200 XP');
    await expect(page.locator('.scan-status')).toContainText(
      'Basic scan of The Moon complete. +20 XP',
    );

    await page.getByRole('tab', { name: 'Advanced data' }).click();
    await expect(page.locator('.data-row dt')).toHaveText([
      'Mean diameter',
      'Average distance from Earth',
    ]);
    await expect(page.getByText('6 more measurements locked')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('scanning needs a selection and being close enough', async ({ page }) => {
    await openForScanning(page);
    await holdScan(page, 150);
    await expect(page.locator('.scan-status')).toHaveText('Select an object to scan.');

    // Click the Sun in the middle of the overview: selected, but far away.
    await page.locator('canvas.game-canvas').click();
    await expect(page.locator('.info-title')).toHaveText('The Sun');
    await holdScan(page, 150);
    await expect(page.locator('.scan-status')).toHaveText('Move closer to scan.');
    await expect(xpText(page)).toHaveText('0 / 200 XP');
  });

  test('letting go early cancels the scan with no reward', async ({ page }) => {
    await openForScanning(page, 2); // a 2 second scan
    await chip(page, 'earth').click();
    await page.waitForTimeout(600); // let the (instant) flight settle
    await holdScan(page, 600);
    await expect(page.locator('.scan-status')).toHaveText('Scan cancelled.');
    await expect(xpText(page)).toHaveText('0 / 200 XP');
  });

  test('scanning the same object again gives no more XP', async ({ page }) => {
    await openForScanning(page);
    await scanObject(page, 'earth');
    await expect(xpText(page)).toHaveText('20 / 200 XP');
    await holdScan(page, 400);
    await expect(page.locator('.scan-status')).toContainText('Nothing new to learn here yet');
    await expect(xpText(page)).toHaveText('20 / 200 XP');
  });

  test('the Space key scans too (keyboard alternative)', async ({ page }) => {
    await openForScanning(page);
    await chip(page, 'sun').click();
    await page.locator('canvas.game-canvas').focus();
    for (let attempt = 0; attempt < 8; attempt++) {
      await page.keyboard.down('Space');
      await page.waitForTimeout(900);
      await page.keyboard.up('Space');
      if (/complete/.test((await page.locator('.scan-status').textContent()) ?? '')) break;
      await page.waitForTimeout(250);
    }
    await expect(xpText(page)).toHaveText('20 / 200 XP');
  });

  test('"tap to scan" mode needs only a tap, no holding', async ({ page }) => {
    await openForScanning(page, 0.6);
    await openSettings(page);
    await page.getByLabel('Scan control').selectOption('tap');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Tap to SCAN' })).toBeVisible();

    await chip(page, 'moon').click();
    for (let attempt = 0; attempt < 8; attempt++) {
      const box = (await page.locator('.scan-button').boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // press and release at once
      await page.waitForTimeout(1200);
      if (/complete/.test((await page.locator('.scan-status').textContent()) ?? '')) break;
    }
    await expect(xpText(page)).toHaveText('20 / 200 XP');
  });

  test('XP and discoveries survive a reload', async ({ page }) => {
    await openForScanning(page);
    await scanObject(page, 'moon');
    await scanObject(page, 'earth');
    await expect(xpText(page)).toHaveText('40 / 200 XP');
    await page.waitForTimeout(300); // let the save finish
    await page.reload();
    await openGame(page);
    await expect(xpText(page)).toHaveText('40 / 200 XP');
    await page.getByRole('button', { name: /Open the Logbook/ }).click();
    await expect(page.locator('.logbook-summary')).toHaveText('Discovered 2 of 10 objects.');
  });
});

test.describe('ranks', () => {
  test('scanning all ten objects earns the first rank-up (Navigator)', async ({ page }) => {
    test.setTimeout(180_000); // ten scans, each with a flight and a short hold
    await openForScanning(page);
    const everyObject = [
      'sun',
      'mercury',
      'venus',
      'earth',
      'moon',
      'mars',
      'phobos',
      'deimos',
      'vesta',
      'ceres',
    ];
    for (const id of everyObject) await scanObject(page, id);
    // 10 first scans x 20 XP = exactly the 200 XP Navigator needs.
    await expect(
      page.getByText('Rank up! You are now a Navigator.', { exact: false }),
    ).toBeVisible();
    await expect(xpText(page)).toContainText('200');
    await expect(xpText(page)).toContainText('600'); // the next goal is Surveyor
  });
});

test.describe('Logbook', () => {
  test('lists scanned objects, hides details of unscanned ones, and blocks scanning while open', async ({
    page,
  }) => {
    await openForScanning(page);
    await scanObject(page, 'moon');
    await page.getByRole('button', { name: /Open the Logbook/ }).click();
    const dialog = page.locator('dialog.logbook-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Discovered 1 of 10 objects.')).toBeVisible();
    await expect(dialog.getByText('Not scanned yet')).toHaveCount(9);
    await expect(dialog.getByText('Basic scan')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('"View in space" closes the Logbook and flies to the object', async ({ page }) => {
    await openForScanning(page);
    await scanObject(page, 'earth');
    await chip(page, 'sun').click(); // look somewhere else first
    await page.getByRole('button', { name: /Open the Logbook/ }).click();
    await page.getByRole('button', { name: 'View Earth in space' }).click();
    await expect(page.locator('dialog.logbook-dialog')).toBeHidden();
    await expect(page.locator('.info-title')).toHaveText('Earth');
    await expect(chip(page, 'earth')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('scanning in the 2D fallback view', () => {
  test('works the same way', async ({ page }) => {
    await openForScanning(page, 0.3, 'renderer=canvas2d');
    await scanObject(page, 'moon');
    await expect(xpText(page)).toHaveText('20 / 200 XP');
  });
});

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { chip, openGame, openSettings } from './helpers';

// Spec gate: "Save survives closing and reopening the browser, and an export restores correctly."

/** Opens Settings, reads the progress line, and closes Settings again. */
async function progressText(page: Page): Promise<string> {
  await openSettings(page);
  const text = (await page.locator('#progress-summary').textContent()) ?? '';
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.settings-dialog')).toBeHidden();
  return text;
}

test('progress survives a reload', async ({ page }) => {
  await openGame(page);
  expect(await progressText(page)).toBe('Objects inspected: 0 of 11');
  await chip(page, 'moon').click();
  await chip(page, 'earth').click();
  await page.reload();
  await openGame(page);
  expect(await progressText(page)).toBe('Objects inspected: 2 of 11 (Earth, The Moon)');
});

test('export, wipe all site data, import: progress is restored', async ({ page }, testInfo) => {
  await openGame(page);
  await chip(page, 'sun').click();
  await chip(page, 'moon').click();

  await openSettings(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  expect(download.suggestedFilename()).toMatch(/^starbound-survey-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(await readFile(file, 'utf8')).save.inspectedObjects).toEqual({
    sun: 1,
    moon: 1,
  });
  await page.keyboard.press('Escape');

  // Wipe everything, like Safari clearing storage for an unused site.
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((done) => {
      const request = indexedDB.deleteDatabase('starbound-survey');
      request.onsuccess = request.onerror = request.onblocked = () => done();
    });
  });
  await page.reload();
  await openGame(page);
  expect(await progressText(page)).toBe('Objects inspected: 0 of 11');

  await openSettings(page);
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await expect(page.locator('#progress-summary')).toHaveText(
    'Objects inspected: 2 of 11 (The Sun, The Moon)',
  );
});

test('a bad backup file is rejected and current progress is untouched', async ({ page }) => {
  await openGame(page);
  await chip(page, 'earth').click();
  await openSettings(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(page.getByText(/Could not restore that file/)).toBeVisible();
  await expect(page.locator('#progress-summary')).toHaveText('Objects inspected: 1 of 11 (Earth)');
});

test('a corrupted save is backed up and the game starts fresh instead of failing', async ({
  page,
}) => {
  await openGame(page);
  await chip(page, 'earth').click();
  await page.waitForTimeout(300); // let the save finish
  // Damage the stored save directly in IndexedDB.
  await page.evaluate(
    () =>
      new Promise<void>((done, fail) => {
        const open = indexedDB.open('starbound-survey', 1);
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ version: 1, xp: 'oops' }, 'progress');
          tx.oncomplete = () => done();
        };
      }),
  );
  await page.reload();
  await openGame(page);
  await expect(page.getByText(/could not be read/)).toBeVisible();
  expect(await progressText(page)).toBe('Objects inspected: 0 of 11');
  // The damaged data was kept as a backup key, not thrown away.
  const keys = await page.evaluate(
    () =>
      new Promise<string[]>((done, fail) => {
        const open = indexedDB.open('starbound-survey', 1);
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('kv').objectStore('kv').getAllKeys();
          req.onsuccess = () => done(req.result.map(String));
        };
      }),
  );
  expect(keys.some((k) => k.startsWith('backup-') && k.endsWith('corrupt'))).toBe(true);
});

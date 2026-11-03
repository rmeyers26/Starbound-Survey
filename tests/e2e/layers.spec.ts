// The Layers tab: the Sun's seven zones, revealed by scanning (atmosphere first, the core last).
import { expect, test } from '@playwright/test';
import { chip, openForScanning, scanObject, setPractice } from './helpers';

const layerNames = (page: import('@playwright/test').Page) =>
  page.locator('.layer-item:not(.locked) .layer-name');

test.describe('layers of the Sun', () => {
  test('only objects that have layers show a Layers tab', async ({ page }) => {
    await openForScanning(page);
    await chip(page, 'earth').click();
    await expect(page.getByRole('tab', { name: 'Advanced data' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Layers' })).toHaveCount(0);
    await chip(page, 'sun').click();
    await expect(page.getByRole('tab', { name: 'Layers' })).toBeVisible();
    await chip(page, 'moon').click();
    await expect(page.getByRole('tab', { name: 'Layers' })).toHaveCount(0); // gone again
  });

  test('a new player must scan the Sun first, then sees the four atmosphere layers', async ({
    page,
  }) => {
    await openForScanning(page);
    await chip(page, 'sun').click();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByText('Scan The Sun to start revealing its layers.')).toBeVisible();

    await scanObject(page, 'sun'); // a basic scan, the only kind a Cadet can do
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(layerNames(page)).toHaveText([
      'The Photosphere',
      'The Chromosphere',
      'The Transition Region',
      'The Corona',
    ]);
    // The inside of the Sun is still hidden, with a hint about how to reveal it.
    await expect(page.locator('.layer-item.locked .layer-name')).toHaveText([
      'A hidden layer',
      'A hidden layer',
      'A hidden layer',
    ]);
    await expect(page.getByText('3 more layers to find.')).toBeVisible();
    await expect(
      page.getByText(/Detailed scan reveals more, and unlocks at the Navigator rank/),
    ).toBeVisible();
    // The picture says how much is revealed (and is not just decoration for screen readers).
    await expect(page.locator('svg.layers-diagram')).toHaveAttribute(
      'aria-label',
      /4 of 7 layers revealed/,
    );
  });

  test("with practice mode every layer is revealed, including NASA's wording", async ({ page }) => {
    await openForScanning(page);
    await setPractice(page, true);
    await scanObject(page, 'sun');
    await scanObject(page, 'sun');
    await scanObject(page, 'sun'); // three levels of scan
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(layerNames(page)).toHaveText([
      'The Core',
      'The Radiative Zone',
      'The Convection Zone',
      'The Photosphere',
      'The Chromosphere',
      'The Transition Region',
      'The Corona',
    ]);
    await expect(page.locator('.layer-item.locked')).toHaveCount(0);
    await expect(page.getByText('more layers to find')).toHaveCount(0);
    await expect(page.getByText(/depth of about 200,000 km/)).toBeVisible();
    await expect(
      page.getByText(/temperature rises from 6,000 °C to about 20,000 °C/),
    ).toBeVisible();
    await expect(page.locator('svg.layers-diagram')).toHaveAttribute(
      'aria-label',
      /7 of 7 layers revealed/,
    );
    await expect(page.locator('svg.layers-diagram circle')).toHaveCount(7);
    await expect(page.locator('.panel-open .pane:not([hidden]) .source')).toContainText(
      'not yet confirmed',
    );
  });

  test('arrow keys move through three tabs for the Sun and two for other objects', async ({
    page,
  }) => {
    await openForScanning(page);
    await chip(page, 'sun').click();
    await page.getByRole('tab', { name: 'Quick facts' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Advanced data' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Layers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight'); // already last: stays put
    await expect(page.getByRole('tab', { name: 'Layers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await chip(page, 'earth').click();
    await page.getByRole('tab', { name: 'Quick facts' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight'); // Earth has no third tab
    await expect(page.getByRole('tab', { name: 'Advanced data' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

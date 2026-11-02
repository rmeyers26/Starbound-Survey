import { expect, test } from '@playwright/test';
import { chip, openGame, trackErrors } from './helpers';

// Spec gate: "Fallback verified with WebGL disabled."

test('the Canvas 2D chart (forced) shows the same data and controls', async ({ page }) => {
  const errors = trackErrors(page);
  await openGame(page, '?renderer=canvas2d');
  await expect(page.locator('.toast')).toHaveCount(0); // forced on purpose: no warning needed
  await chip(page, 'earth').click();
  await expect(page.locator('.info-title')).toHaveText('Earth');
  await page.getByRole('button', { name: /Back to overview/ }).click();
  await page.waitForTimeout(1500); // let the chart glide back
  await page.locator('canvas.game-canvas').click(); // middle of the chart = the Sun
  await expect(page.locator('.info-title')).toHaveText('The Sun');
  expect(errors).toEqual([]);
});

test('losing the GPU rebuilds the 3D view once, then falls back to the 2D chart', async ({
  page,
}) => {
  await openGame(page);
  await chip(page, 'moon').click(); // selection + focus must survive the rebuild
  const loseGpu = () =>
    page.evaluate(() => {
      const gl = (document.querySelector('canvas.game-canvas') as HTMLCanvasElement).getContext(
        'webgl2',
      )!;
      gl.getExtension('WEBGL_lose_context')!.loseContext();
    });

  await loseGpu();
  await expect(page.getByText('The graphics card was reset')).toBeVisible();
  await expect(chip(page, 'moon')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.info-panel')).toBeVisible();

  await loseGpu();
  await expect(page.getByText('switched to a simplified star chart')).toBeVisible();
  await chip(page, 'earth').click();
  await expect(page.locator('.info-title')).toHaveText('Earth'); // still fully playable
});

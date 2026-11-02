// Playwright runs the REAL game in REAL browsers and clicks through it like a player.
//
// Projects (browser + device combinations):
//   chromium-desktop / chromium-mobile : Chrome engine (desktop, and a Pixel 7 phone emulation)
//   webkit-desktop   / webkit-mobile   : Safari's engine (desktop, and an iPhone 13 emulation)
// The WebKit projects need a WebKit browser installed (`npx playwright install webkit`), so they are
// switched on in CI, or locally with PW_WEBKIT=1. Emulation approximates a phone's screen and touch
// input but NOT its GPU speed or heat: that still needs a real phone (see docs/DEVICE_TESTING.md).
import { defineConfig, devices } from '@playwright/test';

const includeWebkit = Boolean(process.env.CI) || process.env.PW_WEBKIT === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2, // the 3D scene is software-rendered on CI machines: keep the load modest
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Test the production build (what players get), not the dev server.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    ...(includeWebkit
      ? [
          { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
          { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
        ]
      : []),
  ],
});

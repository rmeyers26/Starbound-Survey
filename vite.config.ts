import { defineConfig } from 'vitest/config'; // same as Vite's, plus a `test` section for Vitest
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    // Unit tests only. Browser tests in tests/e2e are run by Playwright (npm run test:e2e).
    include: ['tests/unit/**/*.test.ts'],
  },
  build: {
    // By default Vite embeds small files directly in the JavaScript as base64 text.
    // Game data must stay a separate file so it can be fetched at runtime (and so a failed
    // load can show the Retry screen). Returning `false` means "never inline this file";
    // returning `undefined` keeps Vite's normal behaviour for everything else (images etc.).
    assetsInlineLimit: (filePath) => (filePath.endsWith('.json') ? false : undefined),
  },
  plugins: [
    // PWA = Progressive Web App: installable, and playable offline after one visit.
    VitePWA({
      // 'prompt' = never reload the page behind the player's back; we show an "update available"
      // message instead (spec: "a quiet prompt rather than a surprise reload mid-session").
      registerType: 'prompt',
      injectRegister: false, // we register the service worker ourselves in src/pwa.ts
      manifest: {
        name: 'Starbound Survey',
        short_name: 'Starbound',
        description: 'A 3D astronomy exploration game: scan real objects to learn real science.',
        display: 'standalone', // full screen, no browser bars
        orientation: 'any', // portrait and landscape both work
        start_url: '/',
        scope: '/',
        background_color: '#05070f',
        theme_color: '#05070f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the whole game shell up front: code, styles, HTML, the JSON data and the icons.
        // File names contain a content hash, so a new release = new names = a clean update.
        // jpg/webp are the surface textures (e.g. the Moon). Keep each under 2 MB or Workbox skips it.
        globPatterns: ['**/*.{js,css,html,json,png,jpg,webp,svg,webmanifest}'],
        // Delete caches left behind by older releases when the new service worker activates.
        cleanupOutdatedCaches: true,
        // Let a newly activated service worker take control of already-open pages. Without this, a
        // page opened on the very first visit stays uncontrolled, and the "Reload" button of the
        // update prompt would do nothing. (A worker only activates after the player accepts the
        // update prompt, or on the very first install, so this never causes a surprise reload.)
        clientsClaim: true,
        // Opening any URL while offline serves the cached game page.
        navigateFallback: 'index.html',
      },
    }),
  ],
});

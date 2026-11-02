// Generates the PNG app icons in public/ from SVG drawings, using the Chromium that Playwright
// installs. Run with:  node scripts/generate-icons.mjs
// (Icons are committed, so you only need this if you change the artwork.)
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/** The artwork. `scale` shrinks it for "maskable" icons, whose edges the phone may crop away. */
function svg(size, { rounded, scale }) {
  const r = rounded ? size * 0.2 : 0;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs>
      <radialGradient id="bg" cx="50%" cy="40%" r="75%">
        <stop offset="0%" stop-color="#16265a"/><stop offset="100%" stop-color="#05070f"/>
      </radialGradient>
      <radialGradient id="planet" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#ffd98a"/><stop offset="100%" stop-color="#c8782a"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" rx="${(r / size) * 512}" fill="url(#bg)"/>
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <circle cx="120" cy="110" r="5" fill="#fff"/><circle cx="410" cy="150" r="4" fill="#fff"/>
      <circle cx="90" cy="380" r="4" fill="#fff"/><circle cx="430" cy="400" r="6" fill="#fff"/>
      <circle cx="256" cy="256" r="104" fill="url(#planet)"/>
      <ellipse cx="256" cy="262" rx="190" ry="48" fill="none" stroke="#7fd4ff" stroke-width="14"
               transform="rotate(-18 256 262)"/>
    </g>
  </svg>`;
}

const icons = [
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, scale: 0.78 }, // content stays in the safe zone
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.9 }, // iOS rounds the corners itself
];

await mkdir('public', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg(icon.size, icon)}</body>`,
  );
  await page.screenshot({ path: `public/${icon.file}`, omitBackground: true });
  console.log('wrote', icon.file);
}
await browser.close();

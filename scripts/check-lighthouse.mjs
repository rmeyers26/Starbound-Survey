// Runs Lighthouse (Google's page-quality auditor) against a URL and fails if scores drop too low.
// Usage:  CHROME_PATH=/path/to/chrome node scripts/check-lighthouse.mjs http://localhost:4173/
// Thresholds are deliberately modest: Lighthouse on a shared CI machine uses software 3D rendering,
// so performance numbers there are NOT representative of a real phone. Accessibility is reliable.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const THRESHOLDS = { accessibility: 0.95, 'best-practices': 0.9, seo: 0.8, performance: 0.5 };

mkdirSync('test-results', { recursive: true });
const out = 'test-results/lighthouse.json';
execFileSync(
  'npx',
  [
    '--yes',
    'lighthouse@12',
    url,
    '--output=json',
    `--output-path=${out}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --no-sandbox',
    '--quiet',
  ],
  { stdio: 'inherit' },
);

const report = JSON.parse(readFileSync(out, 'utf8'));
let failed = false;
for (const [id, minimum] of Object.entries(THRESHOLDS)) {
  const score = report.categories[id].score;
  const ok = score >= minimum;
  failed ||= !ok;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${id}: ${Math.round(score * 100)} (min ${Math.round(minimum * 100)})`,
  );
}
const a = report.audits;
console.log(
  `FCP ${a['first-contentful-paint'].displayValue}, LCP ${a['largest-contentful-paint'].displayValue}, ` +
    `TBT ${a['total-blocking-time'].displayValue}, transfer ${Math.round(a['total-byte-weight'].numericValue / 1024)} KiB`,
);
process.exit(failed ? 1 : 0);

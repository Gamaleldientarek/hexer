/**
 * Success criterion 1: on real sites, does the site's true primary brand
 * color land in the BRAND group, top two positions?
 *
 * Runs the real scanner against real pages and prints what it found. Expected
 * hexes are recorded as hints, not assertions — sites redesign, and a script
 * that fails because Spotify changed its green is noise, not signal.
 */
import { chromium } from '@playwright/test';
import { scanPage } from '../src/scan/css-scan.js';
import { buildPalette } from '../src/core/palette.js';
import { ELEMENT_CAP } from '../src/core/constants.js';

const SITES = [
  { url: 'https://stripe.com',       expect: '#635BFF' },
  { url: 'https://linear.app',       expect: '#5E6AD2' },
  { url: 'https://vercel.com',       expect: 'black/white brand — accent blue' },
  { url: 'https://tailwindcss.com',  expect: 'sky/cyan' },
  { url: 'https://github.com',       expect: '#0969DA' },
  { url: 'https://www.notion.com',   expect: 'black/white brand' },
  { url: 'https://www.figma.com',    expect: '#F24E1E and friends' },
  { url: 'https://www.spotify.com', expect: '#1DB954' },
  { url: 'https://www.airbnb.com',   expect: '#FF5A5F' },
  { url: 'https://gamaleldien.com',  expect: '#F83200' },
];

const browser = await chromium.launch();
const rows = [];

for (const site of SITES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(site.url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1200);

    const scan = await page.evaluate(scanPage, { elementCap: ELEMENT_CAP });
    const palette = buildPalette(scan);

    const top = (key, n = 3) => (palette.groups[key] || [])
      .slice(0, n)
      .map((e) => e.hex + (e.varName ? ' ' + e.varName : '') + ' ' + e.weightPct.toFixed(1) + '%')
      .join('  |  ');

    rows.push({
      site: site.url.replace(/^https?:\/\//, ''),
      expected: site.expect,
      brand: top('brand'),
      surface: top('surface', 2),
      colors: palette.stats.total,
      vars: scan.vars.length,
      ms: scan.stats.durationMs,
      els: scan.stats.elements,
      sampled: scan.stats.truncated ? 'yes' : '',
    });
  } catch (e) {
    rows.push({ site: site.url, error: String(e.message || e).slice(0, 70) });
  }
  await page.close();
}

await browser.close();

for (const r of rows) {
  if (r.error) { console.log(`\n### ${r.site}\n  ERROR: ${r.error}`); continue; }
  console.log(`\n### ${r.site}   (${r.colors} colors, ${r.vars} vars, ${r.els} els, ${r.ms}ms${r.sampled ? ', SAMPLED' : ''})`);
  console.log(`  expected : ${r.expected}`);
  console.log(`  brand    : ${r.brand || '(none)'}`);
  console.log(`  surface  : ${r.surface || '(none)'}`);
}

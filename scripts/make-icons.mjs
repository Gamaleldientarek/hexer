/**
 * Renders icons/icon.svg to the four PNG sizes the manifest needs.
 * Uses Playwright, already a devDependency, rather than adding an image lib.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SIZES = [16, 32, 48, 128];
const svg = readFileSync('icons/icon.svg', 'utf8');

const browser = await chromium.launch();

for (const size of SIZES) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    '<style>html,body{margin:0;padding:0;background:transparent}' +
    'svg{display:block;width:' + size + 'px;height:' + size + 'px}</style>' + svg
  );
  const buffer = await page.screenshot({ omitBackground: true });
  writeFileSync(path.join('icons', 'icon' + size + '.png'), buffer);
  await page.close();
  console.log('wrote icons/icon' + size + '.png');
}

await browser.close();

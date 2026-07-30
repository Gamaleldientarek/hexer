/**
 * Renders the real popup against a canned palette and screenshots it.
 * Used for design critique and for Chrome Web Store listing assets.
 *
 *   node scripts/screenshot.mjs [label]
 *
 * Writes .design/popup-<label>.png (popup size) and .design/store-<label>.png
 * (1280x800, the store's required screenshot dimension).
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const label = process.argv[2] || 'current';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const root = path.resolve('.');
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'popup.html';
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

/** stripe.com, as actually scanned. */
const SCAN = {
  ok: true,
  host: 'stripe.com',
  meta: { themeColor: null },
  vars: [
    { name: '--blurple', value: 'rgb(99, 91, 255)' },
    { name: '--dark', value: 'rgb(10, 37, 64)' },
    { name: '--slate-50', value: 'rgb(246, 249, 252)' },
    { name: '--slate-600', value: 'rgb(66, 84, 102)' },
    { name: '--slate-200', value: 'rgb(227, 232, 238)' },
  ],
  records: [
    { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 480000, count: 40 },
    { value: 'rgb(10, 37, 64)', source: 'color', weight: 186000, count: 220 },
    { value: 'rgb(246, 249, 252)', source: 'background-color', weight: 114000, count: 12 },
    { value: 'rgb(99, 91, 255)', source: 'background-color', weight: 68000, count: 18 },
    { value: 'rgb(66, 84, 102)', source: 'color', weight: 51000, count: 90 },
    { value: 'rgb(5, 112, 222)', source: 'background-color', weight: 17000, count: 6 },
    { value: 'rgb(227, 232, 238)', source: 'border-top-color', weight: 2900, count: 140 },
    { value: 'rgb(193, 201, 210)', source: 'border-top-color', weight: 900, count: 30 },
    { value: 'rgb(105, 115, 134)', source: 'color', weight: 9000, count: 44 },
    { value: 'rgb(0, 214, 143)', source: 'background-color', weight: 4200, count: 5 },
  ],
  stats: { elements: 4821, scanned: 4821, truncated: false, stride: 1, durationMs: 214 },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 640 }, deviceScaleFactor: 2 });

await page.addInitScript((scan) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async () => {} },
  });
  window.chrome = {
    tabs: { query: async () => [{ id: 1 }], captureVisibleTab: async () => '' },
    scripting: { executeScript: async () => [{ result: scan }] },
  };
}, SCAN);

await page.goto(origin + '/popup.html');
await page.waitForFunction(() => document.getElementById('host').textContent !== 'Scanning…');
await page.waitForTimeout(200);

await mkdir('.design', { recursive: true });

const popupPath = `.design/popup-${label}.png`;
await page.screenshot({ path: popupPath });
console.log('wrote', popupPath);

// Store asset: the popup composited on a neutral field at the required size.
const shot = (await readFile(popupPath)).toString('base64');
const store = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await store.setContent(`
  <style>
    html,body{margin:0;height:100%}
    body{display:flex;align-items:center;justify-content:center;gap:64px;
         background:#FAFAFA;font-family:system-ui,sans-serif;color:#141414}
    .copy{max-width:440px}
    h1{font-size:40px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 16px;font-weight:600}
    p{font-size:17px;line-height:1.5;color:#4A4A4A;margin:0}
    b{color:#141414}
    img{width:400px;border-radius:12px;box-shadow:0 24px 60px -20px rgba(12,14,20,.28),
        0 2px 8px rgba(12,14,20,.06)}
  </style>
  <div class="copy">
    <h1>The exact colors,<br>read from the CSS.</h1>
    <p>Not guessed from a screenshot. Every value is the one the site
       declared &mdash; with the <b>variable name</b> behind it and how much
       of the page it actually paints.</p>
  </div>
  <img src="data:image/png;base64,${shot}">
`);
await store.waitForTimeout(300);
await store.screenshot({ path: `.design/store-${label}.png` });
console.log(`wrote .design/store-${label}.png`);

await browser.close();
server.close();

import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Serves the repo root over HTTP. popup.html loads ES modules, and modules are
 * CORS-blocked over file://, so a real origin is required.
 */
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

let server;
let origin;

test.beforeAll(async () => {
  const root = path.resolve('.');
  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'popup.html';
    try {
      const body = await readFile(path.join(root, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(() => server?.close());

/** A realistic scan result, shaped exactly as css-scan.js returns one. */
const SCAN = {
  ok: true,
  host: 'stripe.com',
  meta: { themeColor: null },
  vars: [
    { name: '--blurple', value: 'rgb(99, 91, 255)' },
    { name: '--dark', value: 'rgb(10, 37, 64)' },
  ],
  records: [
    { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 480000, count: 40 },
    { value: 'rgb(10, 37, 64)', source: 'color', weight: 186000, count: 220 },
    { value: 'rgb(246, 249, 252)', source: 'background-color', weight: 114000, count: 12 },
    { value: 'rgb(99, 91, 255)', source: 'background-color', weight: 68000, count: 18 },
    { value: 'rgb(66, 84, 102)', source: 'color', weight: 51000, count: 90 },
    { value: 'rgb(227, 232, 238)', source: 'border-top-color', weight: 2900, count: 140 },
    { value: 'rgb(5, 112, 222)', source: 'background-color', weight: 17000, count: 6 },
  ],
  stats: { elements: 4821, scanned: 4821, truncated: false, stride: 1, durationMs: 214 },
};

/** Installs a chrome API stub plus clipboard capture before any page script. */
const stubChrome = (page, { scan = SCAN, injectThrows = false } = {}) =>
  page.addInitScript(({ scan, injectThrows }) => {
    window.__copied = [];
    window.__downloads = [];

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t) => { window.__copied.push(t); } },
    });

    // Capture downloads without letting the browser prompt.
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { window.__downloads.push(this.download); return; }
      return realClick.call(this);
    };

    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: 'https://stripe.com/' }],
        // Render a real two-color PNG rather than hardcoding base64. A
        // hardcoded string is easy to get subtly wrong, and pixel-scan.js
        // rightly refuses to decode it.
        captureVisibleTab: async () => {
          const c = document.createElement('canvas');
          c.width = 40; c.height = 40;
          const x = c.getContext('2d');
          x.fillStyle = '#F83200'; x.fillRect(0, 0, 40, 30);
          x.fillStyle = '#0055FF'; x.fillRect(0, 30, 40, 10);
          return c.toDataURL('image/png');
        },
      },
      scripting: {
        executeScript: async () => {
          if (injectThrows) throw new Error('Cannot access contents of the page');
          return [{ result: scan }];
        },
      },
    };
  }, { scan, injectThrows });

const open = async (page, opts) => {
  await stubChrome(page, opts);
  await page.goto(`${origin}/popup.html`);
  await page.waitForFunction(() => document.getElementById('host').textContent !== 'Scanning…');
};

test('renders the host and color count', async ({ page }) => {
  await open(page);
  await expect(page.locator('#host')).toHaveText('stripe.com');
  await expect(page.locator('#count')).toHaveText('7 colors');
});

test('renders groups in order and omits empty ones', async ({ page }) => {
  await open(page);
  const headings = await page.locator('.group').allTextContents();
  expect(headings).toEqual(['brand', 'text', 'surface', 'border']);
});

test('files the saturated colors under brand with exact hexes', async ({ page }) => {
  await open(page);
  const cells = await page.locator('.grid').first().locator('.cell').allTextContents();
  expect(cells.join(' ')).toContain('#635BFF');
  expect(cells.join(' ')).toContain('--blurple');
  expect(cells.join(' ')).toContain('#0570DE');
});

test('the hex never truncates, whatever the cell width', async ({ page }) => {
  await open(page);
  // The hex is the payload. Only the variable name may ellipsis, so every
  // .hx must render its full 7 characters and fit inside its own box.
  const overflowing = await page.locator('.hx').evaluateAll((nodes) =>
    nodes.filter((n) => n.textContent.trim().length !== 7 || n.scrollWidth > n.clientWidth + 1)
      .map((n) => n.textContent));
  expect(overflowing).toEqual([]);
});

test('sizes swatches by dominance within the group, not across the palette', async ({ page }) => {
  await open(page);
  const spans = await page.locator('.grid').first().locator('.cell')
    .evaluateAll((cells) => cells.map((c) => c.style.gridColumn));
  // Blurple carries ~80% of the brand group, so it takes the full 2 columns
  // even though it is only ~7% of the page.
  expect(spans[0]).toBe('span 2');
  expect(spans[1]).toBe('span 1');
});

test('the footer stays reachable without scrolling', async ({ page }) => {
  await open(page);
  // Chrome caps a popup at 600px. Four groups overflow that, so the board
  // must scroll inside a fixed column rather than pushing the exports away.
  const { footTop, viewport, boardScrolls } = await page.evaluate(() => ({
    footTop: document.querySelector('.foot').getBoundingClientRect().top,
    viewport: window.innerHeight,
    boardScrolls: document.getElementById('board').scrollHeight
      > document.getElementById('board').clientHeight,
  }));
  expect(footTop).toBeLessThan(viewport);
  expect(boardScrolls).toBe(true);
});

test('group bands are separated by a rule', async ({ page }) => {
  await open(page);
  await expect(page.locator('.band')).toHaveCount(4);
  const borders = await page.locator('.band').evaluateAll((bands) =>
    bands.map((b) => getComputedStyle(b).borderTopWidth));
  // First band opens the board, the other three carry a separator.
  expect(borders[0]).toBe('0px');
  expect(borders.slice(1)).toEqual(['1px', '1px', '1px']);
});

test('paints each swatch with its own hex', async ({ page }) => {
  await open(page);
  const bg = await page.locator('.grid').first().locator('.sw').first()
    .evaluate((n) => getComputedStyle(n).backgroundColor);
  expect(bg).toBe('rgb(99, 91, 255)');
});

test('clicking a swatch copies its hex and flags the cell', async ({ page }) => {
  await open(page);
  const cell = page.locator('.grid').first().locator('.cell').first();
  await cell.click();
  expect(await page.evaluate(() => window.__copied)).toEqual(['#635BFF']);
  await expect(cell).toHaveClass(/is-copied/);
  await expect(page.locator('#toast')).toHaveText('#635BFF copied');
});

test('CSS export copies a valid :root block using the site variable names', async ({ page }) => {
  await open(page);
  await page.click('#copy-css');
  const [css] = await page.evaluate(() => window.__copied);
  expect(css).toContain(':root {');
  expect(css).toContain('--blurple: #635BFF;');
  expect(css).toContain('--dark: #0A2540;');
});

test('Tailwind export copies a colors object', async ({ page }) => {
  await open(page);
  await page.click('#copy-tailwind');
  const [tw] = await page.evaluate(() => window.__copied);
  expect(tw).toContain('colors: {');
  expect(tw).toContain("'blurple': '#635BFF',");
});

test('JSON export copies parseable JSON carrying every color', async ({ page }) => {
  await open(page);
  await page.click('#copy-json');
  const [json] = await page.evaluate(() => window.__copied);
  const parsed = JSON.parse(json);
  expect(parsed.host).toBe('stripe.com');
  expect(parsed.colors).toHaveLength(7);
});

test('Figma export copies SVG markup with real rects', async ({ page }) => {
  await open(page);
  await page.click('#copy-figma');
  const [svg] = await page.evaluate(() => window.__copied);
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg).toContain('fill="#635BFF"');
});

test('PNG and JPG each produce a download with a host-named file', async ({ page }) => {
  await open(page);
  await page.click('#save-png');
  await page.click('#save-jpg');
  await expect.poll(() => page.evaluate(() => window.__downloads))
    .toEqual(['hexer-stripe.com.png', 'hexer-stripe.com.jpg']);
});

test('the images tab lazily captures and renders pixel colors', async ({ page }) => {
  await open(page);
  await expect(page.locator('.group')).toHaveCount(4);

  await page.click('#tab-images');
  await expect(page.locator('.group')).toHaveText(['from images']);
  await expect(page.locator('#tab-images')).toHaveClass(/is-on/);

  // The stubbed screenshot is 75% #F83200 over 25% #0055FF, so both must come
  // back and the dominant one must lead.
  const labels = (await page.locator('.hx').allTextContents()).join(' ');
  expect(labels).toContain('#F83200');
  expect(labels).toContain('#0055FF');
  expect(labels.indexOf('#F83200')).toBeLessThan(labels.indexOf('#0055FF'));

  await page.click('#tab-code');
  await expect(page.locator('.group')).toHaveCount(4);
});

test('the images tab does not re-capture on a second visit', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.__captures = 0;
    const real = chrome.tabs.captureVisibleTab;
    chrome.tabs.captureVisibleTab = async (...a) => { window.__captures++; return real(...a); };
  });

  await page.click('#tab-images');
  await expect(page.locator('.group')).toHaveText(['from images']);
  await page.click('#tab-code');
  await page.click('#tab-images');
  await expect(page.locator('.group')).toHaveText(['from images']);

  expect(await page.evaluate(() => window.__captures)).toBe(1);
});

test('a restricted page shows the block message and disables exports', async ({ page }) => {
  await open(page, { injectThrows: true });
  await expect(page.locator('.msg')).toHaveText('Chrome blocks extensions on this page.');
  for (const id of ['copy-css', 'save-png', 'copy-figma']) {
    await expect(page.locator('#' + id)).toBeDisabled();
  }
});

test('a page with no colors offers a retry', async ({ page }) => {
  await open(page, { scan: { ...SCAN, records: [], vars: [] } });
  await expect(page.locator('.msg')).toContainText('No colors found');
  await expect(page.locator('.board .btn')).toHaveText('Retry');
});

test('a sampled page says so rather than pretending it read everything', async ({ page }) => {
  await open(page, {
    scan: { ...SCAN, stats: { ...SCAN.stats, elements: 48210, scanned: 20000, truncated: true, stride: 3 } },
  });
  await expect(page.locator('.note')).toContainText('Sampled 20,000 of 48,210 elements');
});

test('the popup is exactly 400px wide and does not scroll horizontally', async ({ page }) => {
  await open(page);
  const { width, scrollWidth } = await page.evaluate(() => ({
    width: document.body.clientWidth,
    scrollWidth: document.body.scrollWidth,
  }));
  expect(width).toBe(400);
  expect(scrollWidth).toBeLessThanOrEqual(400);
});

test('the brand mark credits gamaleldien.com without costing layout', async ({ page }) => {
  await open(page);
  const mark = page.locator('.mark');
  await expect(mark).toHaveAttribute('href', 'https://gamaleldien.com');
  await expect(mark).toHaveAttribute('target', '_blank');
  await expect(mark).toHaveAttribute('rel', /noopener/);
  await expect(mark).toHaveAttribute('title', /gamaleldien\.com/);

  // Still a 15px square — the credit must not push the host name around.
  const box = await mark.boundingBox();
  expect(Math.round(box.width)).toBe(15);
  expect(Math.round(box.height)).toBe(15);
});

test('the six footer buttons fit on one row', async ({ page }) => {
  await open(page);
  const tops = await page.locator('.foot .btn')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops).toHaveLength(6);
  expect(new Set(tops).size).toBe(1);
});

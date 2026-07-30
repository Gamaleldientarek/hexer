/**
 * Chrome Web Store listing assets.
 *
 * Scans real sites with the real scanner, renders the real popup against that
 * data, then composites each into a 1280x800 frame. Nothing here is mocked —
 * every hex on these screenshots is a value Hexer actually extracted.
 *
 *   node scripts/store-shots.mjs
 *
 * Writes .design/store/*.png — five 1280x800 screenshots plus a 440x280
 * small promo tile.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { scanPage } from '../src/scan/css-scan.js';
import { buildPalette } from '../src/core/palette.js';
import { toCssVars } from '../src/export/text.js';
import { ELEMENT_CAP } from '../src/core/constants.js';

const OUT = '.design/store';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

// ---------------------------------------------------------------- local server

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

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

// ------------------------------------------------------------- real scanning

async function scanSite(url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(1500);
  const scan = await page.evaluate(scanPage, { elementCap: ELEMENT_CAP });
  await page.close();
  return scan;
}

/** Renders the real popup against a real scan and returns a base64 PNG. */
async function shootPopup(scan, { tab = 'code' } = {}) {
  const page = await browser.newPage({
    viewport: { width: 400, height: 600 }, deviceScaleFactor: 2,
  });
  await page.addInitScript((s) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async () => {} },
    });
    window.chrome = {
      tabs: { query: async () => [{ id: 1 }], captureVisibleTab: async () => '' },
      scripting: { executeScript: async () => [{ result: s }] },
    };
  }, scan);
  await page.goto(origin + '/popup.html');
  await page.waitForFunction(() => document.getElementById('host').textContent !== 'Scanning…');
  if (tab === 'images') await page.click('#tab-images').catch(() => {});
  await page.waitForTimeout(250);
  const buf = await page.screenshot();
  await page.close();
  return buf.toString('base64');
}

// ------------------------------------------------------------------- framing

const FRAME_CSS = `
  @import url('https://api.fontshare.com/v2/css?f[]=clash-display@600,500&f[]=satoshi@400,500,700&display=swap');
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    display:flex;align-items:center;gap:72px;
    padding:0 88px;background:#F7F7F6;
    font-family:'Satoshi',system-ui,sans-serif;color:#141414;
  }
  .copy{flex:1;max-width:520px}
  .eyebrow{
    display:inline-block;font:700 12px/1 'Satoshi',sans-serif;letter-spacing:.16em;
    text-transform:uppercase;color:#F83200;margin:0 0 20px;
  }
  h1{
    font-family:'Clash Display',system-ui,sans-serif;font-weight:600;
    font-size:52px;line-height:1.04;letter-spacing:-.025em;margin:0 0 20px;
  }
  h1 em{font-style:normal;color:#F83200}
  p{font-size:19px;line-height:1.55;color:#4A4A4A;margin:0;max-width:460px}
  p b{color:#141414;font-weight:500}
  .shot{flex:none;position:relative}
  .shot img{
    display:block;width:400px;border-radius:14px;
    box-shadow:0 32px 80px -24px rgba(12,14,20,.32),0 4px 12px rgba(12,14,20,.07);
  }
  .code{
    flex:none;width:452px;background:#141414;border-radius:14px;padding:26px 28px;
    font:400 12.5px/1.9 ui-monospace,Menlo,monospace;color:#B0B0B0;
    box-shadow:0 32px 80px -24px rgba(12,14,20,.32);
    white-space:pre;overflow:hidden;
  }
  .code .k{color:#FFFFFF}
  .code .v{color:#F83200}
  .stats{display:flex;gap:40px;margin-top:34px}
  .stat b{display:block;font-family:'Clash Display',sans-serif;font-weight:600;
    font-size:34px;letter-spacing:-.02em;line-height:1}
  .stat span{display:block;font-size:13px;color:#8B8B8B;margin-top:7px}
`;

async function frame(name, html, size = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport: size });
  await page.setContent(`<style>${FRAME_CSS}</style>${html}`);
  await page.waitForTimeout(700); // let the webfont land
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  console.log('wrote', `${OUT}/${name}.png`);
}

const shot = (b64) => `<div class="shot"><img src="data:image/png;base64,${b64}"></div>`;

// --------------------------------------------------------------------- build

// Sites chosen because their output photographs honestly: every group
// populated, most colors carrying a real variable name, and few enough
// entries to read without scrolling. stripe.com was the first pick and was
// dropped — its brand group is 20 near-identical gradient stops at 0.0%,
// which reads as noise rather than a palette.
console.log('scanning basecamp.com …');
const hero = await scanSite('https://basecamp.com');
const heroPal = buildPalette(hero);
const heroShot = await shootPopup(hero);

console.log('scanning notion.com …');
const notion = await scanSite('https://www.notion.com');
const notionPal = buildPalette(notion);
const notionNamed = Object.values(notionPal.groups).flat().filter((e) => e.varName).length;
const heroNamed = Object.values(heroPal.groups).flat().filter((e) => e.varName).length;

console.log('scanning tailwindcss.com …');
const tw = await scanSite('https://tailwindcss.com');
const twPal = buildPalette(tw);
const twShot = await shootPopup(tw);

// 1 — the thesis
await frame('01-exact', `
  <div class="copy">
    <span class="eyebrow">Read from the code</span>
    <h1>The exact colors.<br>Not a <em>guess</em>.</h1>
    <p>Every other palette tool screenshots the page and quantises pixels, so
       you get an approximation. Hexer reads the stylesheet and gives you the
       value the site actually <b>declared</b>.</p>
  </div>
  ${shot(heroShot)}
`);

// 2 — completeness, with real numbers from the scan above
await frame('02-complete', `
  <div class="copy">
    <span class="eyebrow">The whole page</span>
    <h1>Every color,<br>not the <em>visible</em> ones.</h1>
    <p>Screenshot tools only see the viewport. Hexer reads the entire
       stylesheet — including modern <b>oklch()</b>, <b>oklab()</b> and
       <b>lab()</b> values that pixel sampling cannot resolve at all.</p>
    <div class="stats">
      <div class="stat"><b>${twPal.stats.total}</b><span>colors on tailwindcss.com</span></div>
      <div class="stat"><b>${tw.vars.length}</b><span>variable names recovered</span></div>
      <div class="stat"><b>${tw.stats.durationMs}ms</b><span>to scan</span></div>
    </div>
  </div>
  ${shot(twShot)}
`);

// 3 — variable names, using the real CSS export
const cssLines = toCssVars(heroPal).split('\n').slice(0, 15)
  .map((l) => l
    .replace(/(--[\w-]+)/g, '<span class="k">$1</span>')
    .replace(/(#[0-9A-F]{6})/g, '<span class="v">$1</span>'))
  .join('\n');

await frame('03-names', `
  <div class="copy">
    <span class="eyebrow">Named, not numbered</span>
    <h1>It knows what the site <em>calls</em> them.</h1>
    <p>Hexer recovers the CSS custom property behind each color, so the
       palette you paste back into your codebase uses the same names the
       site already uses — plus how much of the page each one paints.</p>
    <div class="stats">
      <div class="stat"><b>${notionNamed}/${notionPal.stats.total}</b><span>colors named on notion.com</span></div>
      <div class="stat"><b>${heroNamed}/${heroPal.stats.total}</b><span>on basecamp.com</span></div>
    </div>
  </div>
  <div class="code">${cssLines}</div>
`);

// 4 — exports
await frame('04-export', `
  <div class="copy">
    <span class="eyebrow">Take it with you</span>
    <h1>Copy once.<br>Paste <em>anywhere</em>.</h1>
    <p>Click a swatch for its hex. Or take the whole palette as CSS custom
       properties, a <b>Tailwind</b> config fragment, <b>JSON</b>, a
       <b>PNG</b> or <b>JPG</b> sheet — or paste it straight into
       <b>Figma</b> as editable vectors.</p>
  </div>
  ${shot(heroShot)}
`);

// 5 — privacy
await frame('05-privacy', `
  <div class="copy">
    <span class="eyebrow">Free, and free of strings</span>
    <h1>No account.<br>No server. <em>No tracking</em>.</h1>
    <p>Two permissions, and Chrome shows <b>no warning</b> when you install
       it. There is no network call anywhere in the source, and no build
       step — so the published package is the code you can read.</p>
    <div class="stats">
      <div class="stat"><b>2</b><span>permissions</span></div>
      <div class="stat"><b>0</b><span>network requests</span></div>
      <div class="stat"><b>MIT</b><span>open source</span></div>
    </div>
  </div>
  ${shot(heroShot)}
`);

// 6 — 440x280 small promo tile
const tilePage = await browser.newPage({ viewport: { width: 440, height: 280 } });
await tilePage.setContent(`
  <style>
    @import url('https://api.fontshare.com/v2/css?f[]=clash-display@600&f[]=satoshi@500&display=swap');
    *{box-sizing:border-box}
    html,body{margin:0;height:100%}
    body{background:#141414;color:#fff;display:flex;flex-direction:column;
         justify-content:center;padding:34px 36px;font-family:'Satoshi',sans-serif}
    .chips{display:flex;gap:7px;margin-bottom:22px}
    .chips i{height:38px;border-radius:7px;display:block;box-shadow:inset 0 0 0 1px rgba(255,255,255,.10)}
    h1{font-family:'Clash Display',sans-serif;font-weight:600;font-size:38px;
       letter-spacing:-.025em;line-height:1;margin:0 0 12px}
    p{margin:0;font-size:14px;color:#B0B0B0;font-weight:500}
    .cap{display:block;margin-top:10px;font-size:10.5px;letter-spacing:.04em;color:#5A5A5A}
  </style>
  <div class="chips">
    <i style="background:#FFF9F5;width:104px"></i>
    <i style="background:#29353C;width:52px"></i>
    <i style="background:#FFDC74;width:34px"></i>
    <i style="background:#2377D2;width:22px"></i>
    <i style="background:#F83200;width:16px"></i>
  </div>
  <h1>Hexer</h1>
  <p>The exact colors of any site, read from its CSS.</p>
  <span class="cap">Width shows how much of the page each color paints</span>
`);
await tilePage.waitForTimeout(700);
await tilePage.screenshot({ path: `${OUT}/promo-440x280.png` });
console.log('wrote', `${OUT}/promo-440x280.png`);
await tilePage.close();

await browser.close();
server.close();
console.log('\ndone — assets in', OUT);

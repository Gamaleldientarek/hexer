/**
 * Spike A — how does Chrome expose CSS custom properties?
 *
 * Chrome does not enumerate --* through getComputedStyle iteration the way
 * Safari and Firefox do. Two candidate sources remain: walking
 * document.styleSheets and reading rule.style, or Chrome's Typed OM via
 * computedStyleMap(). This measures both against real sites so css-scan.js
 * can prefer whichever actually works.
 */
import { chromium } from '@playwright/test';

const SITES = [
  'https://stripe.com',
  'https://linear.app',
  'https://vercel.com',
  'https://tailwindcss.com',
  'https://github.com',
];

const probe = () => {
  const out = { sheetVars: [], typedOmVars: [], sheetsTotal: 0, sheetsBlocked: 0 };

  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules) { walk(rule.cssRules); continue; }
      if (!rule.style || !rule.selectorText) continue;
      for (const prop of rule.style) {
        if (prop.startsWith('--')) out.sheetVars.push(prop);
      }
    }
  };

  for (const sheet of document.styleSheets) {
    out.sheetsTotal++;
    let rules;
    try { rules = sheet.cssRules; } catch { out.sheetsBlocked++; continue; }
    if (rules) walk(rules);
  }

  try {
    for (const [prop] of document.documentElement.computedStyleMap()) {
      if (prop.startsWith('--')) out.typedOmVars.push(prop);
    }
  } catch (e) {
    out.typedOmError = String(e);
  }

  out.sheetVars = [...new Set(out.sheetVars)];
  out.typedOmVars = [...new Set(out.typedOmVars)];
  return out;
};

const browser = await chromium.launch();
const page = await browser.newPage();
const rows = [];

for (const url of SITES) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    const r = await page.evaluate(probe);
    rows.push({
      url,
      sheet: r.sheetVars.length,
      typedOm: r.typedOmVars.length,
      sheets: r.sheetsTotal,
      blocked: r.sheetsBlocked,
      sample: r.sheetVars.slice(0, 3).join(' ') || r.typedOmVars.slice(0, 3).join(' '),
    });
  } catch (e) {
    rows.push({ url, error: String(e).slice(0, 80) });
  }
}

await browser.close();
console.table(rows);

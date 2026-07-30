import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { scanPage } from '../../src/scan/css-scan.js';
import { buildPalette } from '../../src/core/palette.js';
import { ELEMENT_CAP } from '../../src/core/constants.js';

const fixture = (name) => pathToFileURL(path.resolve('tests/fixtures', name)).href;

/** Loads a fixture, runs the real scanner in-page, returns the raw scan. */
const scan = async (page, name) => {
  await page.goto(fixture(name));
  await page.waitForTimeout(50);           // let custom elements upgrade
  return page.evaluate(scanPage, { elementCap: ELEMENT_CAP });
};

const weightOf = (result, value, source) =>
  result.records
    .filter((r) => r.value === value && (!source || r.source === source))
    .reduce((s, r) => s + r.weight, 0);

test('hero-dominant: the full-bleed brand color ranks first', async ({ page }) => {
  const palette = buildPalette(await scan(page, 'hero-dominant.html'));
  expect(palette.groups.brand[0].hex).toBe('#F83200');
  expect(palette.groups.brand[0].weight).toBeGreaterThan(palette.groups.brand[1].weight * 100);
});

test('vars-root: custom-property names attach to their colors', async ({ page }) => {
  const result = await scan(page, 'vars-root.html');
  expect(result.vars.map((v) => v.name)).toContain('--brand');
  expect(result.vars.map((v) => v.name)).toContain('--ink');
  expect(result.vars.map((v) => v.name)).not.toContain('--not-a-color');

  const palette = buildPalette(result);
  const all = Object.values(palette.groups).flat();
  expect(all.find((e) => e.hex === '#0055FF').varName).toBe('--brand');
  expect(all.find((e) => e.hex === '#111111').varName).toBe('--ink');
});

test('vars-noise: non-color custom properties are rejected without probing', async ({ page }) => {
  // Spike A found sites with ~2,000 custom properties, mostly non-colors.
  // COLOR_SHAPED must filter them out or the scan blows its time budget.
  const result = await scan(page, 'vars-noise.html');
  const names = result.vars.map((v) => v.name);
  expect(names).toContain('--brand');
  expect(names).toContain('--ink');          // rebeccapurple, a named color
  expect(names).not.toContain('--layout-gap');
  expect(names).not.toContain('--animate-bounce');
  expect(names).not.toContain('--z-modal');
  expect(names).not.toContain('--font-stack');
  expect(names).not.toContain('--ratio');
  expect(result.stats.durationMs).toBeLessThan(400);
});

test('nested-bg: a parent is not credited for area its opaque child covers', async ({ page }) => {
  const result = await scan(page, 'nested-bg.html');
  // .outer is 1000x1000 but .inner covers 1000x900, so white owns 100_000px.
  expect(weightOf(result, 'rgb(255, 255, 255)', 'background-color')).toBeCloseTo(100000, -2);
  expect(weightOf(result, 'rgb(0, 85, 255)', 'background-color')).toBeCloseTo(900000, -2);
});

test('gradient: every stop is found and shares the area evenly', async ({ page }) => {
  const result = await scan(page, 'gradient.html');
  const stops = result.records.filter((r) => r.source === 'gradient-stop');
  const values = stops.map((s) => s.value);
  expect(values).toContain('rgb(248, 50, 0)');
  expect(values).toContain('rgb(0, 85, 255)');
  expect(values).toContain('rgb(17, 17, 17)');
  const each = 300 * 300 / 3;
  for (const s of stops) expect(s.weight).toBeCloseTo(each, -1);
});

test('border-only: a 1px border is classified BORDER and stays under 1%', async ({ page }) => {
  const palette = buildPalette(await scan(page, 'border-only.html'));
  const blue = palette.groups.border.find((e) => e.hex === '#0055FF');
  expect(blue).toBeDefined();
  expect(blue.weightPct).toBeLessThan(1);
});

test('text-heavy: text weight beats a small saturated box', async ({ page }) => {
  const result = await scan(page, 'text-heavy.html');
  expect(weightOf(result, 'rgb(17, 17, 17)', 'color'))
    .toBeGreaterThan(weightOf(result, 'rgb(248, 50, 0)', 'background-color'));
});

test('shadow-dom: colors inside an open shadow root are found', async ({ page }) => {
  const result = await scan(page, 'shadow-dom.html');
  expect(weightOf(result, 'rgb(0, 85, 255)', 'background-color')).toBeGreaterThan(0);
});

test('cross-origin-css: a blocked stylesheet does not throw', async ({ page }) => {
  const result = await scan(page, 'cross-origin-css.html');
  expect(result.ok).toBe(true);
  expect(weightOf(result, 'rgb(248, 50, 0)', 'background-color')).toBeGreaterThan(0);
});

test('perf-5k: a 5,000-element page scans inside the 400ms budget', async ({ page }) => {
  const result = await scan(page, 'perf-5k.html');
  expect(result.stats.elements).toBeGreaterThan(5000);
  expect(result.stats.truncated).toBe(false);
  expect(result.stats.durationMs).toBeLessThan(400);
});

test('sampling: elementCap below the element count triggers truncation', async ({ page }) => {
  await page.goto(fixture('perf-5k.html'));
  const result = await page.evaluate(scanPage, { elementCap: 500 });
  expect(result.stats.truncated).toBe(true);
  expect(result.stats.stride).toBeGreaterThan(1);
  expect(result.stats.scanned).toBeLessThanOrEqual(result.stats.elements);
});

test('every record has a positive weight and a source', async ({ page }) => {
  const result = await scan(page, 'hero-dominant.html');
  for (const r of result.records) {
    expect(r.weight).toBeGreaterThan(0);
    expect(typeof r.source).toBe('string');
    expect(r.count).toBeGreaterThan(0);
  }
});

import { describe, it, expect } from 'vitest';
import { buildPalette } from '../../src/core/palette.js';

const scan = (records, extra = {}) => ({
  ok: true,
  host: 'example.com',
  meta: { themeColor: null },
  vars: [],
  records,
  stats: { elements: 100, scanned: 100, truncated: false, durationMs: 12 },
  ...extra,
});

describe('buildPalette', () => {
  it('returns four empty groups for an empty scan', () => {
    const p = buildPalette(scan([]));
    expect(p.groups).toEqual({ brand: [], text: [], surface: [], border: [] });
    expect(p.stats.total).toBe(0);
  });

  it('carries the host and scan stats through', () => {
    const p = buildPalette(scan([]));
    expect(p.host).toBe('example.com');
    expect(p.stats.elements).toBe(100);
    expect(p.stats.durationMs).toBe(12);
  });

  it('places a saturated sparing fill in brand with an exact hex', () => {
    const p = buildPalette(scan([
      { value: 'rgb(248, 50, 0)', source: 'background-color', weight: 100, count: 2 },
      { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 9000, count: 1 },
    ]));
    expect(p.groups.brand.map((e) => e.hex)).toEqual(['#F83200']);
    expect(p.groups.surface.map((e) => e.hex)).toEqual(['#FFFFFF']);
  });

  // A page needs a dominant surface for an accent to read as sparing. With a
  // single record that color is 100% of the painted area, which roles.js
  // correctly files as a surface rather than a brand color.
  const PAGE_BG = { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 9000, count: 1 };

  it('attaches the site custom-property name when the color matches', () => {
    const p = buildPalette(scan(
      [PAGE_BG, { value: 'rgb(248, 50, 0)', source: 'background-color', weight: 100, count: 1 }],
      { vars: [{ name: '--brand-primary', value: 'rgb(248, 50, 0)' }] },
    ));
    expect(p.groups.brand[0].varName).toBe('--brand-primary');
  });

  it('leaves varName null when no variable matches', () => {
    const p = buildPalette(scan(
      [PAGE_BG, { value: 'rgb(248, 50, 0)', source: 'background-color', weight: 100, count: 1 }],
      { vars: [{ name: '--other', value: 'rgb(0, 85, 255)' }] },
    ));
    expect(p.groups.brand[0].varName).toBeNull();
  });

  it('drops colors below the alpha threshold', () => {
    const p = buildPalette(scan([
      { value: 'rgba(0, 0, 0, 0.01)', source: 'background-color', weight: 500, count: 1 },
      { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 100, count: 1 },
    ]));
    expect(p.stats.total).toBe(1);
    expect(p.groups.surface[0].hex).toBe('#FFFFFF');
  });

  it('counts unparseable values instead of throwing', () => {
    const p = buildPalette(scan([
      { value: 'linear-gradient(red, blue)', source: 'background-color', weight: 10, count: 1 },
      { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 100, count: 1 },
    ]));
    expect(p.stats.unparsed).toBe(1);
    expect(p.stats.total).toBe(1);
  });

  it('merges near-identical colors before assigning roles', () => {
    const p = buildPalette(scan([
      PAGE_BG,
      { value: 'rgb(99, 91, 255)', source: 'background-color', weight: 100, count: 1 },
      { value: 'rgb(99, 92, 255)', source: 'background-color', weight: 40, count: 1 },
    ]));
    expect(p.stats.total).toBe(2);
    expect(p.groups.brand[0].hex).toBe('#635BFF');
    expect(p.groups.brand[0].weight).toBe(140);
  });

  it('keeps pure white and a near-white surface token apart', () => {
    // The whole pitch is exact values, so #FFFFFF and #F6F9FC must not fuse.
    // They sit 0.0199 apart in OKLab, just under the spec's original 0.02.
    const p = buildPalette(scan([
      { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 900, count: 1 },
      { value: 'rgb(246, 249, 252)', source: 'background-color', weight: 100, count: 1 },
    ]));
    expect(p.groups.surface.map((e) => e.hex)).toEqual(['#FFFFFF', '#F6F9FC']);
  });

  it('still merges one-step hex rounding noise', () => {
    const p = buildPalette(scan([
      { value: 'rgb(248, 50, 0)', source: 'background-color', weight: 100, count: 1 },
      { value: 'rgb(249, 51, 1)', source: 'background-color', weight: 40, count: 1 },
    ]));
    expect(p.stats.total).toBe(1);
  });

  it('does not promote a meta theme-color into brand', () => {
    // theme-color is the browser toolbar tint, normally the page background.
    // #0A2540 has chroma 0.060, below the floor, so it belongs in surface.
    const p = buildPalette(scan(
      [{ value: 'rgb(10, 37, 64)', source: 'background-color', weight: 9000, count: 1 }],
      { meta: { themeColor: '#0A2540' } },
    ));
    expect(p.groups.brand).toEqual([]);
    expect(p.groups.surface.map((e) => e.hex)).toEqual(['#0A2540']);
  });

  it('sorts each group by weight descending', () => {
    const p = buildPalette(scan([
      { value: 'rgb(255, 255, 255)', source: 'background-color', weight: 100, count: 1 },
      { value: 'rgb(246, 249, 252)', source: 'background-color', weight: 900, count: 1 },
    ]));
    expect(p.groups.surface.map((e) => e.weight)).toEqual([900, 100]);
  });

  it('tolerates a scan with no vars or meta keys at all', () => {
    const p = buildPalette({
      ok: true, host: 'x.com', records: [], stats: { elements: 0, truncated: false, durationMs: 1 },
    });
    expect(p.groups.brand).toEqual([]);
    expect(p.stats.unparsed).toBe(0);
  });
});

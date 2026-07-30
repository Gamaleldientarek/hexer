import { describe, it, expect } from 'vitest';
import { pixelsToEntries } from '../../src/scan/pixel-scan.js';

const repeat = (triple, n) => Array.from({ length: n }, () => [...triple]);

describe('pixelsToEntries', () => {
  it('returns an empty array for no pixels', () => {
    expect(pixelsToEntries([], { count: 8 })).toEqual([]);
  });

  it('converts each quantised bucket into a palette-shaped entry', () => {
    const [entry] = pixelsToEntries(repeat([248, 50, 0], 40), { count: 8 });
    expect(entry).toMatchObject({
      hex: '#F83200',
      rgb: { r: 248, g: 50, b: 0, a: 1 },
      role: 'brand',
      varName: null,
      merged: [],
    });
  });

  it('sets weightPct from the pixel population', () => {
    const entries = pixelsToEntries(
      [...repeat([250, 0, 0], 75), ...repeat([0, 0, 250], 25)],
      { count: 2 },
    );
    expect(entries[0].weightPct).toBeCloseTo(75, 0);
    expect(entries[1].weightPct).toBeCloseTo(25, 0);
  });

  it('percentages sum to about 100', () => {
    const entries = pixelsToEntries(
      [...repeat([10, 10, 10], 30), ...repeat([200, 200, 200], 70)],
      { count: 4 },
    );
    expect(entries.reduce((s, e) => s + e.weightPct, 0)).toBeCloseTo(100, 0);
  });

  it('sorts by population descending', () => {
    const entries = pixelsToEntries(
      [...repeat([0, 0, 250], 10), ...repeat([250, 0, 0], 90)],
      { count: 2 },
    );
    expect(entries[0].weight).toBeGreaterThan(entries[1].weight);
  });

  it('gives every entry a pixel source so exports label it correctly', () => {
    const [entry] = pixelsToEntries(repeat([1, 2, 3], 10), { count: 4 });
    expect(entry.sources).toEqual({ pixel: 10 });
  });
});

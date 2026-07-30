import { describe, it, expect } from 'vitest';
import { cluster } from '../../src/core/cluster.js';
import { srgbToOklab } from '../../src/core/oklab.js';
import { toHex } from '../../src/core/parse.js';

/** Builds an entry the way palette.js does, so tests match production shape. */
const entry = (rgb, weight, sources = { 'background-color': weight }) => ({
  value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
  hex: toHex(rgb),
  rgb,
  oklab: srgbToOklab(rgb),
  weight,
  weightPct: weight,
  count: 1,
  sources,
});

describe('cluster', () => {
  it('returns an empty array for no entries', () => {
    expect(cluster([], 0.02)).toEqual([]);
  });

  it('leaves visibly different colors separate', () => {
    const out = cluster([
      entry({ r: 248, g: 50, b: 0 }, 100),
      entry({ r: 0, g: 85, b: 255 }, 50),
    ], 0.02);
    expect(out).toHaveLength(2);
  });

  it('merges near-identical colors', () => {
    const out = cluster([
      entry({ r: 99, g: 91, b: 255 }, 100),
      entry({ r: 99, g: 92, b: 255 }, 40),
    ], 0.02);
    expect(out).toHaveLength(1);
  });

  it('keeps the heaviest member as the representative, never an average', () => {
    const out = cluster([
      entry({ r: 99, g: 91, b: 255 }, 100),
      entry({ r: 99, g: 92, b: 255 }, 40),
    ], 0.02);
    expect(out[0].hex).toBe('#635BFF');
    expect(out[0].merged).toEqual(['#635CFF']);
  });

  it('sums weights, percentages and counts of merged members', () => {
    const out = cluster([
      entry({ r: 99, g: 91, b: 255 }, 100),
      entry({ r: 99, g: 92, b: 255 }, 40),
    ], 0.02);
    expect(out[0].weight).toBe(140);
    expect(out[0].weightPct).toBeCloseTo(140);
    expect(out[0].count).toBe(2);
  });

  it('unions the source breakdowns of merged members', () => {
    const out = cluster([
      entry({ r: 99, g: 91, b: 255 }, 100, { 'background-color': 100 }),
      entry({ r: 99, g: 92, b: 255 }, 40, { color: 30, 'background-color': 10 }),
    ], 0.02);
    expect(out[0].sources).toEqual({ 'background-color': 110, color: 30 });
  });

  it('re-sorts so a merged cluster can overtake a heavier singleton', () => {
    const out = cluster([
      entry({ r: 10, g: 10, b: 10 }, 120),
      entry({ r: 99, g: 91, b: 255 }, 100),
      entry({ r: 99, g: 92, b: 255 }, 90),
    ], 0.02);
    expect(out[0].hex).toBe('#635BFF');
    expect(out[0].weight).toBe(190);
  });

  it('merges nothing when deltaMax is zero', () => {
    const out = cluster([
      entry({ r: 99, g: 91, b: 255 }, 100),
      entry({ r: 99, g: 92, b: 255 }, 40),
    ], 0);
    expect(out).toHaveLength(2);
  });

  it('does not mutate the input entries', () => {
    const input = [
      entry({ r: 99, g: 91, b: 255 }, 100),
      entry({ r: 99, g: 92, b: 255 }, 40),
    ];
    const snapshot = JSON.stringify(input);
    cluster(input, 0.02);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

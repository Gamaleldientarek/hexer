import { describe, it, expect } from 'vitest';
import { quantize } from '../../src/core/quantize.js';

const repeat = (triple, n) => Array.from({ length: n }, () => [...triple]);

describe('quantize', () => {
  it('returns an empty array for no pixels', () => {
    expect(quantize([], 8)).toEqual([]);
  });

  it('returns one entry for a solid color', () => {
    const out = quantize(repeat([248, 50, 0], 50), 8);
    expect(out).toHaveLength(1);
    expect(out[0].rgb).toEqual({ r: 248, g: 50, b: 0, a: 1 });
    expect(out[0].population).toBe(50);
  });

  it('separates two well-spaced clusters', () => {
    const out = quantize([...repeat([250, 0, 0], 60), ...repeat([0, 0, 250], 40)], 2);
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.rgb.r)).toEqual([250, 0]);
  });

  it('sorts by population descending', () => {
    const out = quantize([...repeat([0, 0, 250], 10), ...repeat([250, 0, 0], 90)], 2);
    expect(out[0].population).toBe(90);
    expect(out[1].population).toBe(10);
  });

  it('never returns more entries than requested', () => {
    const pixels = [];
    for (let i = 0; i < 40; i++) pixels.push([i * 6, 255 - i * 6, (i * 3) % 256]);
    expect(quantize(pixels, 5).length).toBeLessThanOrEqual(5);
  });

  it('preserves the total pixel population across all entries', () => {
    const pixels = [...repeat([10, 20, 30], 25), ...repeat([200, 210, 220], 75)];
    const out = quantize(pixels, 4);
    expect(out.reduce((s, e) => s + e.population, 0)).toBe(100);
  });

  it('always sets alpha to 1', () => {
    const out = quantize(repeat([1, 2, 3], 5), 4);
    expect(out[0].rgb.a).toBe(1);
  });

  it('returns integer channels', () => {
    const out = quantize([[0, 0, 0], [1, 1, 1], [2, 2, 2]], 1);
    for (const v of [out[0].rgb.r, out[0].rgb.g, out[0].rgb.b]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('does not mutate the input array', () => {
    const pixels = [[9, 8, 7], [1, 2, 3]];
    const snapshot = JSON.stringify(pixels);
    quantize(pixels, 2);
    expect(JSON.stringify(pixels)).toBe(snapshot);
  });
});

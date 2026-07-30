import { describe, it, expect } from 'vitest';
import { rank } from '../../src/core/rank.js';

describe('rank', () => {
  it('returns an empty array for no records', () => {
    expect(rank([])).toEqual([]);
  });

  it('sums weights for the same value across different sources', () => {
    const out = rank([
      { value: 'rgb(1, 1, 1)', source: 'color', weight: 30, count: 3 },
      { value: 'rgb(1, 1, 1)', source: 'background-color', weight: 70, count: 1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].weight).toBe(100);
    expect(out[0].count).toBe(4);
    expect(out[0].sources).toEqual({ color: 30, 'background-color': 70 });
  });

  it('normalises weightPct across the whole set', () => {
    const out = rank([
      { value: 'a', source: 'color', weight: 75, count: 1 },
      { value: 'b', source: 'color', weight: 25, count: 1 },
    ]);
    expect(out[0].weightPct).toBeCloseTo(75);
    expect(out[1].weightPct).toBeCloseTo(25);
  });

  it('sorts by weight descending', () => {
    const out = rank([
      { value: 'small', source: 'color', weight: 1, count: 1 },
      { value: 'big', source: 'color', weight: 100, count: 1 },
      { value: 'mid', source: 'color', weight: 50, count: 1 },
    ]);
    expect(out.map((e) => e.value)).toEqual(['big', 'mid', 'small']);
  });

  it('ranks one full-bleed background above many thin borders', () => {
    const records = [{ value: 'hero', source: 'background-color', weight: 1440 * 900, count: 1 }];
    for (let i = 0; i < 640; i++) {
      records.push({ value: 'border', source: 'border-top-color', weight: 300 * 1, count: 1 });
    }
    const out = rank(records);
    expect(out[0].value).toBe('hero');
    expect(out[1].count).toBe(640);
  });

  it('yields zero percentages rather than NaN when all weights are zero', () => {
    const out = rank([{ value: 'a', source: 'caret-color', weight: 0, count: 1 }]);
    expect(out[0].weightPct).toBe(0);
  });

  it('does not mutate its input', () => {
    const records = [{ value: 'a', source: 'color', weight: 5, count: 1 }];
    const snapshot = JSON.stringify(records);
    rank(records);
    expect(JSON.stringify(records)).toBe(snapshot);
  });
});

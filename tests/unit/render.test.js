import { describe, it, expect } from 'vitest';
import { spanFor, GROUP_ORDER } from '../../src/popup/render.js';

describe('GROUP_ORDER', () => {
  it('runs brand first and border last', () => {
    expect(GROUP_ORDER).toEqual(['brand', 'text', 'surface', 'border']);
  });
});

describe('spanFor', () => {
  it('gives the full 4 columns to a colour that dominates its group', () => {
    expect(spanFor(95, 100)).toBe(4);
  });

  it('gives 3 columns to a half-share colour', () => {
    expect(spanFor(50, 100)).toBe(3);
  });

  it('gives 1 column to a small share', () => {
    expect(spanFor(5, 100)).toBe(1);
  });

  it('never returns less than 1', () => {
    expect(spanFor(0, 100)).toBe(1);
  });

  it('never returns more than 4', () => {
    expect(spanFor(100, 100)).toBe(4);
  });

  it('returns 1 when the group total is zero rather than NaN', () => {
    expect(spanFor(0, 0)).toBe(1);
  });

  it('sizes within the group, not the whole palette', () => {
    // A brand colour at 6.8% of the PAGE but 80% of its GROUP must be large.
    expect(spanFor(6.8, 8.5)).toBe(4);
  });

  it('is monotonic — a heavier colour never gets a smaller span', () => {
    let previous = 0;
    for (const w of [1, 10, 25, 40, 60, 80, 100]) {
      const span = spanFor(w, 100);
      expect(span).toBeGreaterThanOrEqual(previous);
      previous = span;
    }
  });
});

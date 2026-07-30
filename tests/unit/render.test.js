import { describe, it, expect } from 'vitest';
import { spanFor, GROUP_ORDER } from '../../src/popup/render.js';

describe('GROUP_ORDER', () => {
  it('runs brand first and border last', () => {
    expect(GROUP_ORDER).toEqual(['brand', 'text', 'surface', 'border']);
  });
});

describe('spanFor', () => {
  // A 4-column grid spanning 1-2. The earlier 6-column/1-4 range squeezed
  // siblings of a dominant color to ~55px, which truncated the hex itself.
  it('gives the full 2 columns to a color that dominates its group', () => {
    expect(spanFor(95, 100)).toBe(2);
  });

  it('gives 2 columns to a half-share color', () => {
    expect(spanFor(50, 100)).toBe(2);
  });

  it('gives 1 column to a small share', () => {
    expect(spanFor(5, 100)).toBe(1);
  });

  it('never returns less than 1', () => {
    expect(spanFor(0, 100)).toBe(1);
  });

  it('never returns more than 2', () => {
    expect(spanFor(100, 100)).toBe(2);
  });

  it('returns 1 when the group total is zero rather than NaN', () => {
    expect(spanFor(0, 0)).toBe(1);
  });

  it('sizes within the group, not the whole palette', () => {
    // A brand color at 6.8% of the PAGE but 80% of its GROUP must be large.
    expect(spanFor(6.8, 8.5)).toBe(2);
  });

  it('is monotonic — a heavier color never gets a smaller span', () => {
    let previous = 0;
    for (const w of [1, 10, 25, 40, 60, 80, 100]) {
      const span = spanFor(w, 100);
      expect(span).toBeGreaterThanOrEqual(previous);
      previous = span;
    }
  });
});

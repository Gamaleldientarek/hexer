import { describe, it, expect } from 'vitest';
import { parseColor, toHex } from '../../src/core/parse.js';

describe('parseColor — rgb/rgba', () => {
  it('parses legacy comma rgb()', () => {
    expect(parseColor('rgb(99, 91, 255)')).toEqual({ r: 99, g: 91, b: 255, a: 1 });
  });

  it('parses legacy rgba() with alpha', () => {
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it('parses modern space-separated rgb() with slash alpha', () => {
    expect(parseColor('rgb(10 20 30 / 0.25)')).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
  });

  it('parses percentage alpha', () => {
    expect(parseColor('rgba(0, 0, 0, 50%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
  });

  it('rounds fractional channels', () => {
    expect(parseColor('rgb(99.6, 91.2, 255)')).toEqual({ r: 100, g: 91, b: 255, a: 1 });
  });
});

describe('parseColor — hex', () => {
  it('parses 6-digit hex', () => {
    expect(parseColor('#635BFF')).toEqual({ r: 99, g: 91, b: 255, a: 1 });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('parses 4-digit shorthand with alpha', () => {
    const c = parseColor('#0008');
    expect(c.r).toBe(0);
    expect(c.a).toBeCloseTo(0.533, 2);
  });

  it('parses 8-digit hex with alpha', () => {
    const c = parseColor('#F8320080');
    expect(c).toMatchObject({ r: 248, g: 50, b: 0 });
    expect(c.a).toBeCloseTo(0.502, 2);
  });

  it('is case insensitive', () => {
    expect(parseColor('#f83200')).toEqual(parseColor('#F83200'));
  });
});

describe('parseColor — hsl', () => {
  it('parses hsl() red', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('parses hsl() with zero saturation as grey', () => {
    expect(parseColor('hsl(210, 0%, 50%)')).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });

  it('parses hsla() with alpha', () => {
    expect(parseColor('hsla(120, 100%, 50%, 0.4)')).toMatchObject({ a: 0.4 });
  });
});

describe('parseColor — oklch', () => {
  it('parses oklch() to approximately the right sRGB', () => {
    const c = parseColor('oklch(0.628 0.2577 29.23)');
    expect(Math.abs(c.r - 255)).toBeLessThanOrEqual(3);
    expect(c.g).toBeLessThanOrEqual(6);
    expect(c.a).toBe(1);
  });

  it('parses oklch() with percentage lightness and slash alpha', () => {
    const c = parseColor('oklch(62.8% 0.2577 29.23 / 0.5)');
    expect(c.a).toBe(0.5);
  });
});

describe('parseColor — rejections', () => {
  it.each([
    'transparent', 'none', 'currentcolor', 'inherit', '',
    'url(x.png)', 'linear-gradient(red, blue)', 'notacolor', '#12345',
  ])('returns null for %s', (input) => {
    expect(parseColor(input)).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseColor(null)).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe('toHex', () => {
  it('formats uppercase with a leading hash', () => {
    expect(toHex({ r: 99, g: 91, b: 255 })).toBe('#635BFF');
  });

  it('zero-pads single digits', () => {
    expect(toHex({ r: 0, g: 5, b: 16 })).toBe('#000510');
  });

  it('clamps out-of-range channels', () => {
    expect(toHex({ r: -10, g: 300, b: 128 })).toBe('#00FF80');
  });
});

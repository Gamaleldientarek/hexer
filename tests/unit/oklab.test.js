import { describe, it, expect } from 'vitest';
import { srgbToOklab, oklabToOklch, oklchToSrgb, deltaEok } from '../../src/core/oklab.js';

const near = (a, b, tol = 0.002) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('srgbToOklab', () => {
  it('maps white to L=1, a=0, b=0', () => {
    const { L, a, b } = srgbToOklab({ r: 255, g: 255, b: 255 });
    near(L, 1); near(a, 0); near(b, 0);
  });

  it('maps black to all zeros', () => {
    const { L, a, b } = srgbToOklab({ r: 0, g: 0, b: 0 });
    near(L, 0); near(a, 0); near(b, 0);
  });

  it('maps pure red to the reference value', () => {
    const { L, a, b } = srgbToOklab({ r: 255, g: 0, b: 0 });
    near(L, 0.6280); near(a, 0.2249); near(b, 0.1258);
  });
});

describe('oklabToOklch', () => {
  it('gives near-zero chroma for greys', () => {
    const { C } = oklabToOklch(srgbToOklab({ r: 128, g: 128, b: 128 }));
    expect(C).toBeLessThan(0.01);
  });

  it('gives high chroma for a saturated brand orange', () => {
    const { C } = oklabToOklch(srgbToOklab({ r: 248, g: 50, b: 0 }));
    expect(C).toBeGreaterThan(0.15);
  });

  it('returns hue in 0..360', () => {
    const { h } = oklabToOklch(srgbToOklab({ r: 0, g: 85, b: 255 }));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});

describe('oklchToSrgb', () => {
  it('round-trips a saturated color within 2/255', () => {
    const input = { r: 99, g: 91, b: 255 };
    const out = oklchToSrgb(oklabToOklch(srgbToOklab(input)));
    expect(Math.abs(out.r - input.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(out.g - input.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(out.b - input.b)).toBeLessThanOrEqual(2);
  });

  it('clamps out-of-gamut values into 0..255', () => {
    const out = oklchToSrgb({ L: 0.9, C: 0.5, h: 140 });
    for (const v of [out.r, out.g, out.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe('deltaEok', () => {
  it('is zero for identical colors', () => {
    const lab = srgbToOklab({ r: 20, g: 30, b: 40 });
    expect(deltaEok(lab, lab)).toBe(0);
  });

  it('is under 0.02 for a one-step hex difference', () => {
    const a = srgbToOklab({ r: 99, g: 91, b: 255 });
    const b = srgbToOklab({ r: 99, g: 92, b: 255 });
    expect(deltaEok(a, b)).toBeLessThan(0.02);
  });

  it('is over 0.02 for visibly different colors', () => {
    const a = srgbToOklab({ r: 248, g: 50, b: 0 });
    const b = srgbToOklab({ r: 0, g: 85, b: 255 });
    expect(deltaEok(a, b)).toBeGreaterThan(0.02);
  });
});

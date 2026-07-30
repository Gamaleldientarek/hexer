import { describe, it, expect } from 'vitest';
import { assignRole, TEXT_SOURCES, EDGE_SOURCES } from '../../src/core/roles.js';
import { srgbToOklab, oklabToOklch } from '../../src/core/oklab.js';

const OPTS = { chromaMin: 0.08 };

const entry = (rgb, sources, weightPct = 5) => ({
  rgb,
  oklch: oklabToOklch(srgbToOklab(rgb)),
  weightPct,
  sources,
});

const ORANGE = { r: 248, g: 50, b: 0 };
const GREY = { r: 128, g: 128, b: 128 };
const NEAR_BLACK = { r: 20, g: 20, b: 20 };
const WHITE = { r: 255, g: 255, b: 255 };

describe('source sets', () => {
  it('classes text-ish properties as text sources', () => {
    for (const s of ['color', 'text-decoration-color', 'caret-color']) {
      expect(TEXT_SOURCES.has(s)).toBe(true);
    }
  });

  it('classes all four borders plus outline and column-rule as edge sources', () => {
    for (const s of ['border-top-color', 'border-right-color', 'border-bottom-color',
                     'border-left-color', 'outline-color', 'column-rule-color']) {
      expect(EDGE_SOURCES.has(s)).toBe(true);
    }
  });

  it('does not treat fills as text or edge sources', () => {
    for (const s of ['background-color', 'gradient-stop', 'fill', 'stroke']) {
      expect(TEXT_SOURCES.has(s)).toBe(false);
      expect(EDGE_SOURCES.has(s)).toBe(false);
    }
  });
});

describe('assignRole', () => {
  it('assigns BORDER when only edge sources contribute', () => {
    expect(assignRole(entry(GREY, { 'border-top-color': 40 }, 0.4), OPTS)).toBe('border');
  });

  it('assigns TEXT when only text sources contribute', () => {
    expect(assignRole(entry(NEAR_BLACK, { color: 900 }, 18), OPTS)).toBe('text');
  });

  it('assigns BRAND to a saturated color used sparingly', () => {
    expect(assignRole(entry(ORANGE, { 'background-color': 200 }, 6.8), OPTS)).toBe('brand');
  });

  it('still assigns BRAND to a saturated color that dominates the page', () => {
    // There is no area cap. A full-bleed brand hero is the brand color, not
    // a surface — the earlier 20% cap got this backwards.
    expect(assignRole(entry(ORANGE, { 'background-color': 9000 }, 98), OPTS)).toBe('brand');
  });

  it('assigns SURFACE to a dark low-chroma navy rather than BRAND', () => {
    // #0A2540 sits at chroma 0.060, below the 0.08 floor. It reads as a dark
    // surface, which is the borderline case the floor was chosen to place.
    expect(assignRole(entry({ r: 10, g: 37, b: 64 }, { 'background-color': 500 }, 30), OPTS))
      .toBe('surface');
  });

  it('assigns SURFACE to a desaturated fill', () => {
    expect(assignRole(entry(WHITE, { 'background-color': 9000 }, 47), OPTS)).toBe('surface');
  });

  it('treats gradient stops, fill and stroke as fills', () => {
    expect(assignRole(entry(ORANGE, { 'gradient-stop': 100 }, 3), OPTS)).toBe('brand');
    expect(assignRole(entry(ORANGE, { fill: 100 }, 3), OPTS)).toBe('brand');
    expect(assignRole(entry(ORANGE, { stroke: 100 }, 3), OPTS)).toBe('brand');
  });

  it('ignores meta theme-color entirely', () => {
    // theme-color tints the browser toolbar and is nearly always the page
    // background. Forcing it into brand put #FFFFFF at the top of Figma's and
    // Airbnb's brand groups. Chroma decides, nothing else.
    expect(assignRole(entry(WHITE, { 'background-color': 9000 }, 47), OPTS)).toBe('surface');
  });

  it('breaks a text/fill tie toward whichever weighs more', () => {
    expect(assignRole(entry(NEAR_BLACK, { color: 900, 'background-color': 100 }, 20), OPTS)).toBe('text');
    expect(assignRole(entry(NEAR_BLACK, { color: 100, 'background-color': 900 }, 20), OPTS)).toBe('surface');
  });

  it('prefers text over border when a color is used as both', () => {
    expect(assignRole(entry(GREY, { color: 500, 'border-top-color': 20 }, 9), OPTS)).toBe('text');
  });

  it('does not assign BORDER when a fill also uses the color', () => {
    expect(assignRole(entry(GREY, { 'border-top-color': 20, 'background-color': 500 }, 9), OPTS)).toBe('surface');
  });

  it('treats a color at exactly the chroma floor as eligible for BRAND', () => {
    const e = entry(ORANGE, { 'background-color': 100 }, 5);
    e.oklch = { ...e.oklch, C: 0.08 };
    expect(assignRole(e, OPTS)).toBe('brand');
  });

  it('treats a color just below the chroma floor as SURFACE', () => {
    const e = entry(ORANGE, { 'background-color': 100 }, 5);
    e.oklch = { ...e.oklch, C: 0.079 };
    expect(assignRole(e, OPTS)).toBe('surface');
  });

  it('falls back to SURFACE for an entry with no recognised sources', () => {
    expect(assignRole(entry(GREY, {}, 0), OPTS)).toBe('surface');
  });
});

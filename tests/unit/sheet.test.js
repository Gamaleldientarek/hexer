import { describe, it, expect } from 'vitest';
import { layout, toSvg, drawSheet } from '../../src/export/sheet.js';

const entry = (hex, weightPct, varName = null) => ({
  hex, weightPct, varName, weight: weightPct, count: 1, sources: {}, merged: [],
});

const palette = {
  host: 'stripe.com',
  groups: {
    brand:   [entry('#635BFF', 6.8, '--blurple'), entry('#0570DE', 1.7)],
    text:    [entry('#0A2540', 18.6)],
    surface: [entry('#FFFFFF', 47.2)],
    border:  [],
  },
  stats: { total: 4 },
};

describe('layout', () => {
  const l = layout(palette);

  it('produces one cell per color', () => {
    expect(l.cells).toHaveLength(4);
  });

  it('produces one heading per non-empty group', () => {
    expect(l.headings.map((h) => h.text)).toEqual(['BRAND', 'TEXT', 'SURFACE']);
  });

  it('gives every cell a positive size', () => {
    for (const c of l.cells) {
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
    }
  });

  it('never places a cell outside the sheet', () => {
    for (const c of l.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(l.width);
      expect(c.y + c.h).toBeLessThanOrEqual(l.height);
    }
  });

  it('starts a new row for each group', () => {
    expect(l.cells[2].y).toBeGreaterThan(l.cells[0].y);
  });

  it('labels cells with the hex, and the variable name when present', () => {
    expect(l.cells[0].label).toContain('#635BFF');
    expect(l.cells[0].label).toContain('--blurple');
    expect(l.cells[1].label).toContain('#0570DE');
  });

  it('scales height with the number of groups', () => {
    const small = layout({
      ...palette,
      groups: { brand: [entry('#000000', 1)], text: [], surface: [], border: [] },
    });
    expect(small.height).toBeLessThan(l.height);
  });
});

describe('toSvg', () => {
  const svg = toSvg(palette);

  it('is a well-formed standalone svg element', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('declares width and height matching the layout', () => {
    const l = layout(palette);
    expect(svg).toContain('width="' + l.width + '"');
    expect(svg).toContain('height="' + l.height + '"');
  });

  it('emits one rect per color with the exact hex as fill', () => {
    expect((svg.match(/<rect/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(svg).toContain('fill="#635BFF"');
    expect(svg).toContain('fill="#0570DE"');
  });

  it('names each rect so Figma layers are readable after pasting', () => {
    expect(svg).toContain('#635BFF');
    expect(svg).toContain('--blurple');
  });

  it('includes the host as a title', () => {
    expect(svg).toContain('stripe.com');
  });

  it('escapes characters that would break the markup', () => {
    const out = toSvg({ ...palette, host: 'a<b>&"c' });
    expect(out).not.toContain('<b>');
    expect(out).toContain('&lt;b&gt;');
    expect(out).toContain('&amp;');
  });

  it('handles an empty palette without producing invalid markup', () => {
    const out = toSvg({
      host: 'x.com',
      groups: { brand: [], text: [], surface: [], border: [] },
      stats: { total: 0 },
    });
    expect(out.startsWith('<svg')).toBe(true);
    expect(out).toContain('</svg>');
  });
});

describe('drawSheet', () => {
  /** Minimal 2D-context stand-in that records the calls made against it. */
  const stubCtx = () => {
    const calls = [];
    return {
      calls,
      canvas: { width: 0, height: 0 },
      set fillStyle(v) { calls.push(['fillStyle', v]); },
      set font(v) { calls.push(['font', v]); },
      set textBaseline(v) { calls.push(['textBaseline', v]); },
      set strokeStyle(v) { calls.push(['strokeStyle', v]); },
      set lineWidth(v) { calls.push(['lineWidth', v]); },
      fillRect: (...a) => calls.push(['fillRect', ...a]),
      fillText: (...a) => calls.push(['fillText', ...a]),
      strokeRect: (...a) => calls.push(['strokeRect', ...a]),
    };
  };

  it('fills a rect for every color plus the background', () => {
    const ctx = stubCtx();
    drawSheet(palette, ctx);
    expect(ctx.calls.filter(([op]) => op === 'fillRect').length).toBeGreaterThanOrEqual(5);
  });

  it('sets each swatch fill to the exact hex', () => {
    const ctx = stubCtx();
    drawSheet(palette, ctx);
    const styles = ctx.calls.filter(([op]) => op === 'fillStyle').map(([, v]) => v);
    expect(styles).toContain('#635BFF');
    expect(styles).toContain('#0A2540');
  });

  it('sizes the canvas to the layout', () => {
    const ctx = stubCtx();
    drawSheet(palette, ctx);
    const l = layout(palette);
    expect(ctx.canvas.width).toBe(l.width);
    expect(ctx.canvas.height).toBe(l.height);
  });

  it('writes a text label for every color', () => {
    const ctx = stubCtx();
    drawSheet(palette, ctx);
    const texts = ctx.calls.filter(([op]) => op === 'fillText').map(([, v]) => v);
    expect(texts.some((t) => t.includes('#635BFF'))).toBe(true);
  });
});

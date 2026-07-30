import { describe, it, expect } from 'vitest';
import { nameFor, toCssVars, toTailwind, toJson } from '../../src/export/text.js';

const entry = (hex, role, weightPct, varName = null) => ({
  hex, role, weightPct, varName,
  weight: weightPct, count: 1, sources: { 'background-color': weightPct }, merged: [],
});

const palette = {
  host: 'stripe.com',
  groups: {
    brand:   [entry('#635BFF', 'brand', 6.8, '--blurple'), entry('#0570DE', 'brand', 1.7)],
    text:    [entry('#0A2540', 'text', 18.6, '--dark')],
    surface: [entry('#FFFFFF', 'surface', 47.2)],
    border:  [],
  },
  stats: { elements: 4821, scanned: 4821, truncated: false, durationMs: 214, unparsed: 0, total: 4 },
};

describe('nameFor', () => {
  it('uses the site variable name with the leading dashes stripped', () => {
    expect(nameFor(entry('#635BFF', 'brand', 6.8, '--blurple'), 'brand', 0, new Set()))
      .toBe('blurple');
  });

  it('falls back to role and index when there is no variable', () => {
    expect(nameFor(entry('#0570DE', 'brand', 1.7), 'brand', 1, new Set())).toBe('brand-2');
  });

  it('lowercases and kebab-cases awkward variable names', () => {
    expect(nameFor(entry('#000000', 'text', 1, '--Brand_Primary Color'), 'text', 0, new Set()))
      .toBe('brand-primary-color');
  });

  it('suffixes duplicates instead of colliding', () => {
    const used = new Set();
    expect(nameFor(entry('#111', 'brand', 1, '--x'), 'brand', 0, used)).toBe('x');
    expect(nameFor(entry('#222', 'text', 1, '--x'), 'text', 0, used)).toBe('x-2');
    expect(nameFor(entry('#333', 'text', 1, '--x'), 'text', 1, used)).toBe('x-3');
  });

  it('falls back when a variable name sanitises to nothing', () => {
    expect(nameFor(entry('#000000', 'text', 1, '--___'), 'text', 3, new Set())).toBe('text-4');
  });
});

describe('toCssVars', () => {
  const css = toCssVars(palette);

  it('opens a :root block and closes it', () => {
    expect(css.startsWith(':root {')).toBe(true);
    expect(css.trimEnd().endsWith('}')).toBe(true);
  });

  it('emits one declaration per color with the exact hex', () => {
    expect(css).toContain('--blurple: #635BFF;');
    expect(css).toContain('--brand-2: #0570DE;');
    expect(css).toContain('--dark: #0A2540;');
    expect(css).toContain('--surface-1: #FFFFFF;');
  });

  it('annotates each declaration with its share of the page', () => {
    expect(css).toContain('/* 6.8% */');
  });

  it('groups declarations under a role comment', () => {
    expect(css).toContain('/* brand */');
    expect(css).toContain('/* text */');
  });

  it('omits empty groups entirely', () => {
    expect(css).not.toContain('/* border */');
  });
});

describe('toTailwind', () => {
  const tw = toTailwind(palette);

  it('emits a colors object', () => {
    expect(tw).toContain('colors: {');
  });

  it('nests colors under their role', () => {
    expect(tw).toContain('brand: {');
    expect(tw).toContain("'blurple': '#635BFF',");
  });

  it('omits empty groups', () => {
    expect(tw).not.toContain('border: {');
  });
});

describe('toJson', () => {
  const json = JSON.parse(toJson(palette, { now: '2026-07-30T10:00:00.000Z' }));

  it('records host and generation time', () => {
    expect(json.host).toBe('stripe.com');
    expect(json.generated).toBe('2026-07-30T10:00:00.000Z');
  });

  it('flattens every color into one array with its role', () => {
    expect(json.colors).toHaveLength(4);
    expect(json.colors[0]).toMatchObject({ hex: '#635BFF', role: 'brand', varName: '--blurple' });
  });

  it('carries the usage count and source breakdown', () => {
    expect(json.colors[0].count).toBe(1);
    expect(json.colors[0].sources).toEqual({ 'background-color': 6.8 });
  });

  it('carries scan stats', () => {
    expect(json.stats.elements).toBe(4821);
  });

  it('is stable — same palette, same output', () => {
    expect(toJson(palette, { now: 'X' })).toBe(toJson(palette, { now: 'X' }));
  });
});

describe('empty palette', () => {
  const empty = {
    host: 'x.com',
    groups: { brand: [], text: [], surface: [], border: [] },
    stats: { elements: 0, scanned: 0, truncated: false, durationMs: 1, unparsed: 0, total: 0 },
  };

  it('still produces a valid :root block', () => {
    expect(toCssVars(empty)).toContain(':root {');
  });

  it('still produces parseable JSON with no colors', () => {
    expect(JSON.parse(toJson(empty, { now: 'X' })).colors).toEqual([]);
  });
});

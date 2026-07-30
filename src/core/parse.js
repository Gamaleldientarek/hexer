import { oklchToSrgb } from './oklab.js';

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Reads an alpha token that may be a number or a percentage. */
const readAlpha = (tok) => {
  if (tok === undefined || tok === '') return 1;
  const t = String(tok).trim();
  if (t.endsWith('%')) return clamp01(parseFloat(t) / 100);
  const n = parseFloat(t);
  return Number.isFinite(n) ? clamp01(n) : 1;
};

/** Splits the inside of a color function into value tokens plus optional alpha. */
const splitArgs = (inner) => {
  const [main, alphaPart] = inner.split('/');
  const parts = main.trim().split(/[\s,]+/).filter(Boolean);
  return { parts, alpha: alphaPart !== undefined ? readAlpha(alphaPart) : undefined };
};

const parseHex = (s) => {
  const h = s.slice(1);
  if (!/^[0-9a-f]+$/i.test(h)) return null;
  const expand = (c) => parseInt(c + c, 16);
  if (h.length === 3) return { r: expand(h[0]), g: expand(h[1]), b: expand(h[2]), a: 1 };
  if (h.length === 4) return { r: expand(h[0]), g: expand(h[1]), b: expand(h[2]), a: expand(h[3]) / 255 };
  if (h.length === 6) return {
    r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1,
  };
  if (h.length === 8) return {
    r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16) / 255,
  };
  return null;
};

const parseRgb = (inner) => {
  const { parts, alpha } = splitArgs(inner);
  if (parts.length < 3) return null;
  const chan = (t) => (t.endsWith('%') ? (parseFloat(t) / 100) * 255 : parseFloat(t));
  const [r, g, b] = parts.slice(0, 3).map(chan);
  if (![r, g, b].every(Number.isFinite)) return null;
  const a = alpha !== undefined ? alpha : (parts[3] !== undefined ? readAlpha(parts[3]) : 1);
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a };
};

const parseHsl = (inner) => {
  const { parts, alpha } = splitArgs(inner);
  if (parts.length < 3) return null;
  const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hp) % 6];

  const a = alpha !== undefined ? alpha : (parts[3] !== undefined ? readAlpha(parts[3]) : 1);
  return { r: clamp255((seg[0] + m) * 255), g: clamp255((seg[1] + m) * 255), b: clamp255((seg[2] + m) * 255), a };
};

const parseOklch = (inner) => {
  const { parts, alpha } = splitArgs(inner);
  if (parts.length < 3) return null;
  const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
  const C = parseFloat(parts[1]);
  const h = parseFloat(parts[2]);
  if (![L, C, h].every(Number.isFinite)) return null;
  const rgb = oklchToSrgb({ L, C, h });
  return { ...rgb, a: alpha !== undefined ? alpha : 1 };
};

/**
 * Parses a CSS color string into { r, g, b, a }. Returns null for anything
 * that is not a concrete color — keywords, gradients, urls, malformed input.
 *
 * css-scan.js normalises harvested values through the browser's own CSS parser,
 * so in practice this receives rgb()/rgba(). Hex, hsl() and oklch() are
 * supported because custom-property values and <meta theme-color> arrive raw.
 */
export function parseColor(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();
  if (s === '') return null;

  if (s.startsWith('#')) return parseHex(s);

  const fn = s.match(/^([a-z]+)\((.*)\)$/);
  if (!fn) return null;

  const [, name, inner] = fn;
  if (name === 'rgb' || name === 'rgba') return parseRgb(inner);
  if (name === 'hsl' || name === 'hsla') return parseHsl(inner);
  if (name === 'oklch') return parseOklch(inner);
  return null;
}

/** Formats { r, g, b } as an uppercase #RRGGBB string. */
export function toHex({ r, g, b }) {
  const h = (v) => clamp255(v).toString(16).padStart(2, '0');
  return ('#' + h(r) + h(g) + h(b)).toUpperCase();
}

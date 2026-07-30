import { parseColor, toHex } from './parse.js';
import { srgbToOklab, oklabToOklch } from './oklab.js';
import { rank } from './rank.js';
import { cluster } from './cluster.js';
import { assignRole } from './roles.js';
import { ALPHA_MIN, CLUSTER_DELTA_E, CHROMA_BRAND_MIN } from './constants.js';

const GROUP_KEYS = ['brand', 'text', 'surface', 'border'];

/** Maps hex to the first custom-property name that resolves to it. */
const indexVars = (vars = []) => {
  const byHex = new Map();
  for (const v of vars) {
    const rgb = parseColor(v.value);
    if (!rgb) continue;
    const hex = toHex(rgb);
    if (!byHex.has(hex)) byHex.set(hex, v.name);
  }
  return byHex;
};

/**
 * Turns a raw scan result into the grouped, ranked palette the UI renders.
 * Pure — no DOM, no chrome APIs — so the whole computation is unit-testable.
 */
export function buildPalette(scan) {
  const ranked = rank(scan.records || []);

  const entries = [];
  let unparsed = 0;

  for (const e of ranked) {
    const rgb = parseColor(e.value);
    if (!rgb) { unparsed++; continue; }
    if (rgb.a < ALPHA_MIN) continue;

    const oklab = srgbToOklab(rgb);
    entries.push({ ...e, rgb, oklab, oklch: oklabToOklch(oklab), hex: toHex(rgb) });
  }

  const clustered = cluster(entries, CLUSTER_DELTA_E);

  const varsByHex = indexVars(scan.vars);

  const groups = { brand: [], text: [], surface: [], border: [] };

  for (const e of clustered) {
    const role = assignRole(e, { chromaMin: CHROMA_BRAND_MIN });
    groups[role].push({ ...e, role, varName: varsByHex.get(e.hex) ?? null });
  }

  for (const key of GROUP_KEYS) groups[key].sort((a, b) => b.weight - a.weight);

  return {
    host: scan.host,
    groups,
    stats: { ...scan.stats, unparsed, total: clustered.length },
  };
}

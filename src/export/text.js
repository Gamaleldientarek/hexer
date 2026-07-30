import { GROUP_ORDER } from '../popup/render.js';

/**
 * Derives a CSS-safe, unique name for a color. Prefers the site's own
 * custom-property name — pasting a palette back into a codebase is far more
 * useful when the names match what the site already calls them.
 */
export function nameFor(entry, role, index, used) {
  const fallback = role + '-' + (index + 1);

  let base = entry.varName ? entry.varName.replace(/^--/, '') : fallback;
  base = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) base = fallback;

  let name = base;
  let n = 2;
  while (used.has(name)) name = base + '-' + n++;

  used.add(name);
  return name;
}

/** Walks every non-empty group in order, sharing one name registry. */
const eachNamed = (palette, visit) => {
  const used = new Set();
  for (const role of GROUP_ORDER) {
    const items = palette.groups[role] || [];
    if (!items.length) continue;
    visit(role, items, (entry, i) => nameFor(entry, role, i, used));
  }
};

export function toCssVars(palette) {
  const lines = [':root {'];

  eachNamed(palette, (role, items, name) => {
    lines.push('  /* ' + role + ' */');
    items.forEach((entry, i) => {
      lines.push(
        '  --' + name(entry, i) + ': ' + entry.hex + ';' +
        '  /* ' + entry.weightPct.toFixed(1) + '% */'
      );
    });
  });

  lines.push('}', '');
  return lines.join('\n');
}

export function toTailwind(palette) {
  const lines = ['// tailwind.config.js — theme.extend', 'colors: {'];

  eachNamed(palette, (role, items, name) => {
    lines.push('  ' + role + ': {');
    items.forEach((entry, i) => {
      lines.push("    '" + name(entry, i) + "': '" + entry.hex + "',");
    });
    lines.push('  },');
  });

  lines.push('}', '');
  return lines.join('\n');
}

export function toJson(palette, { now = new Date().toISOString() } = {}) {
  const colors = [];

  for (const role of GROUP_ORDER) {
    for (const entry of palette.groups[role] || []) {
      colors.push({
        hex: entry.hex,
        role,
        weightPct: Number(entry.weightPct.toFixed(3)),
        varName: entry.varName,
        count: entry.count,
        sources: entry.sources,
        merged: entry.merged,
      });
    }
  }

  return JSON.stringify({
    tool: 'Hexer',
    host: palette.host,
    generated: now,
    stats: palette.stats,
    colors,
  }, null, 2);
}

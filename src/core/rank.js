/**
 * Aggregates raw color records into one entry per distinct color value,
 * carrying the total painted-area weight, a per-source breakdown, and each
 * color's share of the page.
 *
 * Weight — not occurrence count — is the ranking metric: a 1px border used
 * 640 times must not outrank one full-bleed hero.
 */
export function rank(records) {
  const byValue = new Map();

  for (const rec of records) {
    let entry = byValue.get(rec.value);
    if (!entry) {
      entry = { value: rec.value, weight: 0, count: 0, sources: {} };
      byValue.set(rec.value, entry);
    }
    entry.weight += rec.weight;
    entry.count += rec.count;
    entry.sources[rec.source] = (entry.sources[rec.source] || 0) + rec.weight;
  }

  const entries = [...byValue.values()];
  const total = entries.reduce((sum, e) => sum + e.weight, 0);

  for (const e of entries) {
    e.weightPct = total > 0 ? (e.weight / total) * 100 : 0;
  }

  return entries.sort((a, b) => b.weight - a.weight);
}

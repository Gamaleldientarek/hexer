import { deltaEok } from './oklab.js';

/**
 * Merges perceptually near-identical colors.
 *
 * `entries` must arrive sorted by weight descending. Because the first
 * matching cluster wins, the heaviest member becomes the representative and
 * its exact declared value survives — we never average colors, since an
 * average is a value the site never actually declared.
 */
export function cluster(entries, deltaMax) {
  const clusters = [];

  for (const e of entries) {
    const hit = clusters.find((c) => deltaEok(c.oklab, e.oklab) < deltaMax);

    if (!hit) {
      clusters.push({ ...e, sources: { ...e.sources }, merged: [] });
      continue;
    }

    hit.weight += e.weight;
    hit.weightPct += e.weightPct;
    hit.count += e.count;
    hit.merged.push(e.hex);
    for (const [source, weight] of Object.entries(e.sources)) {
      hit.sources[source] = (hit.sources[source] || 0) + weight;
    }
  }

  return clusters.sort((a, b) => b.weight - a.weight);
}

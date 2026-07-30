/**
 * Color quantisation by recursive largest-gap splitting.
 *
 * Repeatedly takes the largest bucket, finds the channel with the widest
 * spread, sorts on it, and splits at the **largest gap between consecutive
 * values** — not at the median index, which is what textbook median cut does.
 *
 * The distinction matters for this tool. Median cut splits by pixel count, so
 * on a page that is 90% white with a 10% brand accent the median falls inside
 * the white cluster: it splits white in two and never isolates the accent.
 * Splitting at the gap separates clusters regardless of how lopsided their
 * populations are, which is the normal shape of a web page.
 *
 * Written here rather than vendored so the extension carries no third-party
 * code or licence.
 */
export function quantize(pixels, count) {
  if (!pixels.length) return [];

  let buckets = [pixels.slice()];

  while (buckets.length < count) {
    buckets.sort((a, b) => b.length - a.length);

    const splittable = buckets.findIndex((b) => b.length > 1);
    if (splittable === -1) break;

    const bucket = buckets.splice(splittable, 1)[0];

    let channel = 0;
    let widest = -1;
    for (let c = 0; c < 3; c++) {
      let min = 255, max = 0;
      for (const p of bucket) {
        if (p[c] < min) min = p[c];
        if (p[c] > max) max = p[c];
      }
      if (max - min > widest) { widest = max - min; channel = c; }
    }

    if (widest === 0) { buckets.push(bucket); break; }

    bucket.sort((a, b) => a[channel] - b[channel]);

    // Split where consecutive values are furthest apart. Both sides are
    // guaranteed non-empty because the cut index is always in 1..length-1.
    let cut = 1;
    let widestGap = -1;
    for (let i = 0; i < bucket.length - 1; i++) {
      const gap = bucket[i + 1][channel] - bucket[i][channel];
      if (gap > widestGap) { widestGap = gap; cut = i + 1; }
    }

    buckets.push(bucket.slice(0, cut), bucket.slice(cut));
  }

  return buckets
    .filter((b) => b.length > 0)
    .map((b) => {
      let r = 0, g = 0, bl = 0;
      for (const p of b) { r += p[0]; g += p[1]; bl += p[2]; }
      return {
        rgb: {
          r: Math.round(r / b.length),
          g: Math.round(g / b.length),
          b: Math.round(bl / b.length),
          a: 1,
        },
        population: b.length,
      };
    })
    .sort((a, b) => b.population - a.population);
}

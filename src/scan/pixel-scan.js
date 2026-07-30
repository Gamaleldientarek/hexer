import { quantize } from '../core/quantize.js';
import { toHex } from '../core/parse.js';

const ALPHA_OPAQUE = 200;

/**
 * Turns raw [r,g,b] pixels into entries shaped like the CSS pipeline's, so
 * render.js and the exporters treat both sources identically.
 *
 * Every entry is role 'brand': the pixel tab is a flat list, not a
 * classification, and pretending otherwise would imply knowledge we do not
 * have from a screenshot.
 */
export function pixelsToEntries(pixels, { count }) {
  const buckets = quantize(pixels, count);
  const total = buckets.reduce((sum, b) => sum + b.population, 0);

  return buckets.map((b) => ({
    hex: toHex(b.rgb),
    rgb: b.rgb,
    weight: b.population,
    weightPct: total > 0 ? (b.population / total) * 100 : 0,
    count: b.population,
    sources: { pixel: b.population },
    merged: [],
    varName: null,
    role: 'brand',
  }));
}

/**
 * Decodes a captureVisibleTab data URL, downsamples it, and quantises.
 * fetch() on a data: URL makes no network request.
 */
export async function pixelScan(dataUrl, { max, count }) {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= ALPHA_OPAQUE) pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  return pixelsToEntries(pixels, { count });
}

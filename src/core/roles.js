/** Properties that paint glyphs or carets. */
export const TEXT_SOURCES = new Set([
  'color',
  'text-decoration-color',
  'caret-color',
]);

/** Properties that paint edges. */
export const EDGE_SOURCES = new Set([
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'column-rule-color',
]);

const sumWhere = (sources, predicate) => {
  let total = 0;
  for (const [source, weight] of Object.entries(sources)) {
    if (predicate(source)) total += weight;
  }
  return total;
};

/**
 * Classifies one color into brand / text / surface / border.
 *
 * BRAND means saturated, full stop. An earlier draft also required the color
 * to cover under 20% of the page, reasoning that accents are used sparingly.
 * That was wrong: a site whose hero is a full-bleed brand color would have had
 * that color filed as a surface and a stray 100px chip promoted to brand.
 * Area orders colors within a group; it does not decide which group.
 *
 * The spec listed "any text source wins" and "assign by whichever source
 * weighs more" as separate rules, which conflict when a color is used as both
 * text and fill. The weight comparison is the general case and subsumes the
 * other: text with no fill weight always wins the comparison.
 *
 * <meta name="theme-color"> is deliberately NOT forced into brand. An earlier
 * draft did that, and it was measurably wrong: theme-color sets the browser
 * toolbar tint, which is nearly always the page background. It put #FFFFFF at
 * the top of Figma's and Airbnb's brand groups, #FAFAFA at the top of
 * Vercel's, and #08090A at the top of Linear's.
 */
export function assignRole(entry, { chromaMin }) {
  const textWeight = sumWhere(entry.sources, (s) => TEXT_SOURCES.has(s));
  const edgeWeight = sumWhere(entry.sources, (s) => EDGE_SOURCES.has(s));
  const fillWeight = sumWhere(entry.sources, (s) => !TEXT_SOURCES.has(s) && !EDGE_SOURCES.has(s));

  if (edgeWeight > 0 && textWeight === 0 && fillWeight === 0) return 'border';
  if (textWeight > 0 && textWeight > fillWeight) return 'text';

  return entry.oklch.C >= chromaMin ? 'brand' : 'surface';
}

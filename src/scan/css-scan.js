/**
 * Harvests every color a page paints, weighted by painted area.
 *
 * CONSTRAINT: this function is serialised and injected via
 * chrome.scripting.executeScript({ func }). It may not import anything or
 * reference outer scope. Every helper nests inside it. That is why this file
 * is longer than the rest of the codebase.
 */
export function scanPage({ elementCap }) {
  const t0 = performance.now();

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD',
    'NOSCRIPT', 'TEMPLATE', 'BR', 'WBR',
  ]);
  const NON_COLORS = new Set([
    '', 'transparent', 'none', 'currentcolor', 'auto', 'inherit', 'initial', 'unset',
    'rgba(0, 0, 0, 0)',
  ]);
  const COLOR_RE =
    /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g;
  // Cheap gate before the resolve probe: a hex, a color function, or a bare
  // word short enough to be a named color such as rebeccapurple. Rejects
  // --layout-gap: 24px and --animate-bounce: bounce 1s infinite without paying
  // for a style recalculation. Each alternative carries its own end anchor —
  // the function branch must NOT be anchored, or "rgb(0, 0, 0)" would fail.
  const COLOR_SHAPED =
    /^(?:#[0-9a-fA-F]{3,8}$|(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color|color-mix)\(|[a-z]{3,20}$)/i;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const OPACITY_MIN = 0.05;

  // ---------------------------------------------------------------- records

  const records = new Map();

  const add = (value, source, weight) => {
    if (!value || !(weight > 0)) return;
    const v = String(value).trim();
    if (NON_COLORS.has(v.toLowerCase())) return;

    const key = v + '|' + source;
    let entry = records.get(key);
    if (!entry) {
      entry = { value: v, source, weight: 0, count: 0 };
      records.set(key, entry);
    }
    entry.weight += weight;
    entry.count += 1;
  };

  // ------------------------------------------------------------------ probe
  // Let the browser's own CSS parser resolve any color syntax — named
  // colors, hsl(), color-mix(), whatever ships next year. Cheaper and far
  // more correct than reimplementing CSS color parsing here.

  const probe = document.createElement('span');
  probe.setAttribute('style', 'display:none !important');
  document.documentElement.appendChild(probe);

  const resolveColor = (raw) => {
    if (!raw) return null;
    const v = String(raw).trim();
    if (NON_COLORS.has(v.toLowerCase())) return null;
    probe.style.color = '';
    try { probe.style.color = v; } catch (e) { return null; }
    if (probe.style.color === '') return null;
    return getComputedStyle(probe).color;
  };

  // ------------------------------------------------------------ normalisation
  // Chrome serialises modern color functions in their own space, so computed
  // styles hand back oklab(), lab(), lch() and oklch(0 0 none / 0.54) verbatim.
  // Tailwind v4 sites are almost entirely oklab/lab: on tailwindcss.com, 222 of
  // 225 distinct values arrived in those forms.
  //
  // A 1x1 canvas converts anything Chrome can parse into exact sRGB bytes, so
  // the downstream pure code only ever sees rgb()/rgba(). Cheaper and far more
  // future-proof than reimplementing CIELAB and OKLab inverses by hand.

  const swatch = document.createElement('canvas');
  swatch.width = 1;
  swatch.height = 1;
  const sctx = swatch.getContext('2d', { willReadFrequently: true });

  const normaliseCache = new Map();

  const toRgbString = (value) => {
    const cached = normaliseCache.get(value);
    if (cached !== undefined) return cached;

    let out = value;
    try {
      sctx.clearRect(0, 0, 1, 1);
      sctx.fillStyle = value;
      sctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = sctx.getImageData(0, 0, 1, 1).data;
      out = a === 255
        ? 'rgb(' + r + ', ' + g + ', ' + b + ')'
        : 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (a / 255).toFixed(3) + ')';
    } catch (e) { /* leave the original value; parse.js will judge it */ }

    normaliseCache.set(value, out);
    return out;
  };

  // -------------------------------------------------------- custom properties
  //
  // Typed OM is the ONLY source that works. Spike A measured the alternative —
  // walking document.styleSheets and iterating rule.style — at zero custom
  // properties on all five test sites, including three where no stylesheet was
  // cross-origin blocked. CSSStyleDeclaration iteration exposes standard
  // longhands only. See docs/spikes.md.
  //
  // A bonus: Typed OM reads computed values, so it does not care whether a rule
  // came from a cross-origin sheet. stripe.com blocks all 5 of its stylesheets
  // and still yields 714 variables.

  const vars = [];

  try {
    for (const [prop, value] of document.documentElement.computedStyleMap()) {
      if (!prop.startsWith('--')) continue;

      const raw = String(value).trim();
      if (!COLOR_SHAPED.test(raw)) continue;

      const resolved = resolveColor(raw);
      if (resolved) vars.push({ name: prop, value: resolved });
    }
  } catch (e) { /* Typed OM unavailable: variable names are simply absent */ }

  const metaEl = document.querySelector('meta[name="theme-color"]');
  const themeColor = metaEl ? resolveColor(metaEl.getAttribute('content')) : null;

  // ------------------------------------------------------------- collection

  const all = [];
  const collect = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (SKIP_TAGS.has(el.tagName)) continue;
      all.push(el);
      if (el.shadowRoot) collect(el.shadowRoot);
    }
  };
  collect(document);

  const stride = all.length > elementCap ? Math.ceil(all.length / elementCap) : 1;
  const elements = stride === 1 ? all : all.filter((_, i) => i % stride === 0);

  // ------------------------------------- pass 1: styles, areas, opaque flags

  const info = new Map();

  for (const el of elements) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;

    const opacity = parseFloat(cs.opacity);
    if (Number.isFinite(opacity) && opacity < OPACITY_MIN) continue;

    const rect = el.getBoundingClientRect();
    const area = Math.max(0, rect.width * rect.height);
    const bg = cs.backgroundColor;

    info.set(el, {
      cs, rect, area,
      hasBg: !!bg && !NON_COLORS.has(bg.toLowerCase()),
    });
  }

  // --------------------------------------------- pass 2: attribute weights

  const capitalise = (s) => s[0].toUpperCase() + s.slice(1);

  const directTextLength = (el) => {
    let n = 0;
    for (const node of el.childNodes) {
      if (node.nodeType === 3) n += node.nodeValue.trim().length;
    }
    return n;
  };

  for (const [el, d] of info) {
    const { cs, rect, area } = d;

    // Own area: subtract the area opaque children paint over. An
    // approximation of occlusion, not exact — exact is not worth the compute.
    let own = area;
    for (const child of el.children) {
      const cd = info.get(child);
      if (cd && cd.hasBg) own -= cd.area;
    }
    own = Math.max(0, own) * stride;

    if (d.hasBg) add(cs.backgroundColor, 'background-color', own);

    if (cs.backgroundImage && cs.backgroundImage !== 'none' && own > 0) {
      const stops = cs.backgroundImage.match(COLOR_RE) || [];
      for (const stop of stops) add(stop, 'gradient-stop', own / stops.length);
    }

    const textLength = directTextLength(el);
    if (textLength > 0) {
      const fontSize = parseFloat(cs.fontSize) || 16;
      add(cs.color, 'color', fontSize * fontSize * 0.5 * textLength * stride);

      if (cs.textDecorationLine && cs.textDecorationLine !== 'none') {
        add(cs.textDecorationColor, 'text-decoration-color',
            fontSize * textLength * 0.08 * stride);
      }
    }

    const sides = [
      ['top', rect.width], ['bottom', rect.width],
      ['left', rect.height], ['right', rect.height],
    ];
    for (const [side, length] of sides) {
      const width = parseFloat(cs['border' + capitalise(side) + 'Width']) || 0;
      if (width > 0 && cs['border' + capitalise(side) + 'Style'] !== 'none') {
        add(cs['border' + capitalise(side) + 'Color'],
            'border-' + side + '-color', length * width * stride);
      }
    }

    const outlineWidth = parseFloat(cs.outlineWidth) || 0;
    if (outlineWidth > 0 && cs.outlineStyle !== 'none') {
      add(cs.outlineColor, 'outline-color',
          2 * (rect.width + rect.height) * outlineWidth * stride);
    }

    const ruleWidth = parseFloat(cs.columnRuleWidth) || 0;
    if (ruleWidth > 0 && cs.columnRuleStyle !== 'none') {
      add(cs.columnRuleColor, 'column-rule-color', rect.height * ruleWidth * stride);
    }

    if (el.namespaceURI === SVG_NS) {
      add(cs.fill, 'fill', area * stride);
      add(cs.stroke, 'stroke', area * stride);
    }

    add(cs.caretColor, 'caret-color', 1);

    if (area > 0) {
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (!ps || ps.content === 'none' || ps.content === 'normal') continue;

        const pw = Math.max(0, parseFloat(ps.width) || 0);
        const ph = Math.max(0, parseFloat(ps.height) || 0);
        if (pw > 0 && ph > 0) {
          add(ps.backgroundColor, 'background-color', pw * ph * stride);
        }

        const pfs = parseFloat(ps.fontSize) || 16;
        add(ps.color, 'color', pfs * pfs * 0.5 * stride);
      }
    }
  }

  probe.remove();

  // Normalise every harvested value to sRGB. Two syntaxes for the same color
  // collapse to one string here; rank() keys by value, so it merges them.
  const normalisedRecords = [...records.values()]
    .map((r) => ({ ...r, value: toRgbString(r.value) }));

  const normalisedVars = vars.map((v) => ({ ...v, value: toRgbString(v.value) }));

  return {
    ok: true,
    host: location.host || location.href,
    meta: { themeColor: themeColor ? toRgbString(themeColor) : null },
    vars: normalisedVars,
    records: normalisedRecords,
    stats: {
      elements: all.length,
      scanned: elements.length,
      truncated: stride > 1,
      stride,
      durationMs: Math.round(performance.now() - t0),
    },
  };
}

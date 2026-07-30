export const GROUP_ORDER = ['brand', 'text', 'surface', 'border'];

const GRID_COLUMNS = 4;
const SPAN_MIN = 1;
const SPAN_MAX = 2;

/**
 * Column span for one swatch, from its share of its OWN group.
 *
 * Sizing is per-group on purpose. Sized against the whole palette, a white
 * surface at 47% would swallow the popup and the brand color at 6.8% would
 * be a speck — backwards, since the brand color is what the tool is for.
 *
 * A 4-column grid spanning 1–2, not 6 spanning 1–4. The wider range looked
 * better empty and failed with real data: a 4-of-6 dominant swatch squeezed
 * its siblings to ~55px, which truncated the hex itself — the one thing the
 * user came for. Every cell now clears the widest hex plus its percentage.
 */
export function spanFor(weight, groupTotal) {
  if (!(groupTotal > 0)) return SPAN_MIN;
  const share = weight / groupTotal;
  return Math.max(SPAN_MIN, Math.min(SPAN_MAX, Math.round(share * GRID_COLUMNS)));
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const captionFor = (entry) => {
  const parts = [entry.hex];
  if (entry.varName) parts.push(entry.varName);
  parts.push(entry.weightPct.toFixed(1) + '%');
  return parts.join('  ');
};

/**
 * Two caption lines, not one. The hex must never truncate — it is the payload.
 * The variable name is the only part allowed to ellipsis, and the percentage
 * is pinned right so the column can be scanned.
 */
const captionNodes = (entry) => {
  const hex = el('span', 'hx', entry.hex);

  const meta = el('span', 'meta');
  meta.append(el('span', 'var', entry.varName || ''));
  meta.append(el('span', 'pct', entry.weightPct.toFixed(1) + '%'));

  return [hex, meta];
};

/** Renders one labelled grid of swatches. Used by both tabs. */
export function renderGroup(label, items, root, onCopy) {
  if (!items || items.length === 0) return;

  const groupTotal = items.reduce((sum, e) => sum + e.weight, 0);

  const band = el('section', 'band');
  band.append(el('h2', 'group', label));

  const grid = el('div', 'grid');

  for (const entry of items) {
    const cell = el('button', 'cell');
    cell.style.gridColumn = 'span ' + spanFor(entry.weight, groupTotal);
    cell.title = captionFor(entry);
    cell.setAttribute('aria-label', 'Copy ' + entry.hex);

    const swatch = el('span', 'sw');
    swatch.style.background = entry.hex;

    cell.append(swatch, ...captionNodes(entry));
    cell.addEventListener('click', () => onCopy(entry.hex, cell));
    grid.append(cell);
  }

  band.append(grid);
  root.append(band);
}

/** Builds the full swatch board. Empty groups never render a heading. */
export function renderBoard(palette, root, onCopy) {
  root.textContent = '';

  for (const key of GROUP_ORDER) {
    renderGroup(key, palette.groups[key], root, onCopy);
  }

  if (palette.stats.truncated) {
    root.append(el('p', 'note',
      'Sampled ' + palette.stats.scanned.toLocaleString() +
      ' of ' + palette.stats.elements.toLocaleString() + ' elements.'));
  }
}

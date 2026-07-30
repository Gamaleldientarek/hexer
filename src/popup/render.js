export const GROUP_ORDER = ['brand', 'text', 'surface', 'border'];

const GRID_COLUMNS = 6;
const SPAN_MIN = 1;
const SPAN_MAX = 4;

/**
 * Column span for one swatch, from its share of its OWN group.
 *
 * Sizing is per-group on purpose. Sized against the whole palette, a white
 * surface at 47% would swallow the popup and the brand colour at 6.8% would
 * be a speck — backwards, since the brand colour is what the tool is for.
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

/** Renders one labelled grid of swatches. Used by both tabs. */
export function renderGroup(label, items, root, onCopy) {
  if (!items || items.length === 0) return;

  const groupTotal = items.reduce((sum, e) => sum + e.weight, 0);

  root.append(el('h2', 'group', label));

  const grid = el('div', 'grid');

  for (const entry of items) {
    const cell = el('button', 'cell');
    cell.style.gridColumn = 'span ' + spanFor(entry.weight, groupTotal);
    cell.title = captionFor(entry);
    cell.setAttribute('aria-label', 'Copy ' + entry.hex);

    const swatch = el('span', 'sw');
    swatch.style.background = entry.hex;

    cell.append(swatch, el('span', 'hx', captionFor(entry)));
    cell.addEventListener('click', () => onCopy(entry.hex, cell));
    grid.append(cell);
  }

  root.append(grid);
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

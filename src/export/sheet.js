import { GROUP_ORDER } from '../popup/render.js';

const SHEET_WIDTH = 1200;
const PAD = 48;
const COLS = 5;
const GAP = 16;
const SWATCH_H = 150;
const LABEL_H = 30;
const HEADING_H = 42;
const TITLE_H = 70;

const CELL_W = Math.floor((SHEET_WIDTH - PAD * 2 - GAP * (COLS - 1)) / COLS);
const ROW_H = SWATCH_H + LABEL_H + GAP;

const labelFor = (entry) => {
  const parts = [entry.hex];
  if (entry.varName) parts.push(entry.varName);
  parts.push(entry.weightPct.toFixed(1) + '%');
  return parts.join('   ');
};

/**
 * Computes the sheet geometry once. Both toSvg and drawSheet consume this,
 * so the PNG and the Figma paste can never drift out of alignment.
 */
export function layout(palette) {
  const headings = [];
  const cells = [];
  let y = TITLE_H;

  for (const role of GROUP_ORDER) {
    const items = palette.groups[role] || [];
    if (!items.length) continue;

    headings.push({ x: PAD, y: y + 22, text: role.toUpperCase() });
    y += HEADING_H;

    items.forEach((entry, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      cells.push({
        x: PAD + col * (CELL_W + GAP),
        y: y + row * ROW_H,
        w: CELL_W,
        h: SWATCH_H,
        hex: entry.hex,
        label: labelFor(entry),
      });
    });

    y += Math.ceil(items.length / COLS) * ROW_H;
  }

  return { width: SHEET_WIDTH, height: Math.max(y + PAD, TITLE_H + PAD), headings, cells };
}

const escapeXml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function toSvg(palette) {
  const l = layout(palette);
  const parts = [];

  parts.push(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + l.width + '" height="' + l.height + '" ' +
    'viewBox="0 0 ' + l.width + ' ' + l.height + '">'
  );
  parts.push('<rect width="' + l.width + '" height="' + l.height + '" fill="#FFFFFF"/>');

  parts.push(
    '<text x="' + PAD + '" y="44" font-family="system-ui, sans-serif" font-size="26" ' +
    'font-weight="600" fill="#141414">' + escapeXml(palette.host) + '</text>'
  );

  for (const h of l.headings) {
    parts.push(
      '<text x="' + h.x + '" y="' + h.y + '" font-family="system-ui, sans-serif" ' +
      'font-size="13" letter-spacing="2" fill="#8B8B8B">' + escapeXml(h.text) + '</text>'
    );
  }

  for (const c of l.cells) {
    // The group is titled so Figma's layer list reads usefully after pasting.
    parts.push(
      '<g><title>' + escapeXml(c.label) + '</title>' +
      '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" ' +
      'rx="10" fill="' + c.hex + '" stroke="#00000014" stroke-width="1"/>' +
      '<text x="' + c.x + '" y="' + (c.y + c.h + 20) + '" ' +
      'font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#4A4A4A">' +
      escapeXml(c.label) + '</text></g>'
    );
  }

  parts.push('</svg>', '');
  return parts.join('\n');
}

export function drawSheet(palette, ctx) {
  const l = layout(palette);

  ctx.canvas.width = l.width;
  ctx.canvas.height = l.height;

  // Filling the background first also gives JPEG a white matte, so the
  // flattened output has no black where transparency would be.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, l.width, l.height);

  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#141414';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText(palette.host, PAD, 44);

  ctx.font = '13px system-ui, sans-serif';
  for (const h of l.headings) {
    ctx.fillStyle = '#8B8B8B';
    ctx.fillText(h.text, h.x, h.y);
  }

  for (const c of l.cells) {
    ctx.fillStyle = c.hex;
    ctx.fillRect(c.x, c.y, c.w, c.h);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillText(c.label, c.x, c.y + c.h + 20);
  }
}

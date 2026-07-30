import { scanPage } from '../scan/css-scan.js';
import { pixelScan } from '../scan/pixel-scan.js';
import { buildPalette } from '../core/palette.js';
import { renderBoard, renderGroup } from './render.js';
import { toCssVars, toTailwind, toJson } from '../export/text.js';
import { toSvg, drawSheet } from '../export/sheet.js';
import { ELEMENT_CAP, PIXEL_SAMPLE_MAX, PIXEL_COLOR_COUNT } from '../core/constants.js';

const EXPORT_BUTTONS = ['copy-css', 'copy-tailwind', 'copy-json', 'save-png', 'save-jpg', 'copy-figma'];
const CAPTURE_COOLDOWN_MS = 600;

/**
 * Scans the active tab and builds its palette.
 * Returns { palette } on success or { error } with a user-facing message.
 */
export async function runScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { error: 'No active tab.' };

  let injected;
  try {
    injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPage,
      args: [{ elementCap: ELEMENT_CAP }],
    });
  } catch (e) {
    // Injection failure is how we detect a restricted page — far more robust
    // than sniffing the URL scheme, which misses the Web Store and other
    // extensions' pages.
    return { error: 'Chrome blocks extensions on this page.' };
  }

  const scan = injected?.[0]?.result;
  if (!scan?.ok) return { error: 'Could not read this page.' };

  return { palette: buildPalette(scan) };
}

let toastTimer;

function toast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-on'), 1200);
}

async function copyHex(hex, cell) {
  await navigator.clipboard.writeText(hex);
  cell.classList.add('is-copied');
  setTimeout(() => cell.classList.remove('is-copied'), 900);
  toast(hex + ' copied');
}

function showMessage(text, actionLabel, onAction) {
  const board = document.getElementById('board');
  board.textContent = '';

  const p = document.createElement('p');
  p.className = 'msg';
  p.textContent = text;
  board.append(p);

  if (actionLabel) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    board.append(button);
  }

  for (const id of EXPORT_BUTTONS) document.getElementById(id).disabled = true;
}

function bindExports(palette) {
  const copyText = (text, label) => async () => {
    await navigator.clipboard.writeText(text);
    toast(label + ' copied');
  };

  document.getElementById('copy-css')
    .addEventListener('click', copyText(toCssVars(palette), 'CSS'));
  document.getElementById('copy-tailwind')
    .addEventListener('click', copyText(toTailwind(palette), 'Tailwind'));
  document.getElementById('copy-json')
    .addEventListener('click', copyText(toJson(palette), 'JSON'));

  const download = (blob, extension) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hexer-' + palette.host.replace(/[^a-z0-9.-]/gi, '-') + '.' + extension;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveImage = (mime, extension, quality) => () => {
    const canvas = document.createElement('canvas');
    drawSheet(palette, canvas.getContext('2d'));
    canvas.toBlob((blob) => {
      download(blob, extension);
      toast(extension.toUpperCase() + ' saved');
    }, mime, quality);
  };

  document.getElementById('save-png').addEventListener('click', saveImage('image/png', 'png'));
  document.getElementById('save-jpg').addEventListener('click', saveImage('image/jpeg', 'jpg', 0.92));

  document.getElementById('copy-figma').addEventListener('click', async () => {
    await navigator.clipboard.writeText(toSvg(palette));
    toast('Paste into Figma with ⌘V');
  });
}

function bindTabs(palette, board) {
  const tabCode = document.getElementById('tab-code');
  const tabImages = document.getElementById('tab-images');
  let pixelEntries = null;

  const setTab = (onCode) => {
    tabCode.classList.toggle('is-on', onCode);
    tabImages.classList.toggle('is-on', !onCode);
    tabCode.setAttribute('aria-selected', String(onCode));
    tabImages.setAttribute('aria-selected', String(!onCode));
  };

  tabCode.addEventListener('click', () => {
    setTab(true);
    renderBoard(palette, board, copyHex);
  });

  tabImages.addEventListener('click', async () => {
    setTab(false);

    if (pixelEntries) {
      board.textContent = '';
      renderGroup('from images', pixelEntries, board, copyHex);
      return;
    }

    board.textContent = 'Reading the screenshot…';
    tabImages.disabled = true;

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      pixelEntries = await pixelScan(dataUrl, {
        max: PIXEL_SAMPLE_MAX,
        count: PIXEL_COLOR_COUNT,
      });
      board.textContent = '';
      renderGroup('from images', pixelEntries, board, copyHex);
    } catch (e) {
      board.textContent = 'Could not capture this page.';
    } finally {
      // captureVisibleTab is capped at 2 calls/sec; this keeps a fast
      // double-click from tripping it.
      setTimeout(() => { tabImages.disabled = false; }, CAPTURE_COOLDOWN_MS);
    }
  });
}

async function init() {
  const board = document.getElementById('board');
  const hostEl = document.getElementById('host');

  const { palette, error } = await runScan();

  if (error) {
    hostEl.textContent = 'Hexer';
    showMessage(error);
    return;
  }

  hostEl.textContent = palette.host;

  if (palette.stats.total === 0) {
    showMessage('No colors found — the page may still be loading.', 'Retry',
      () => location.reload());
    return;
  }

  document.getElementById('count').textContent = palette.stats.total + ' colors';
  renderBoard(palette, board, copyHex);
  bindExports(palette);
  bindTabs(palette, board);
}

init();

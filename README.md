# Hexer

**See the exact colours a website declares — read from its CSS, not guessed from a screenshot.**

One click. No account, no subscription, no server, no network calls. Free and MIT.

---

## Why

Every colour-palette extension I could find works the same way: it takes a **screenshot** of the page and runs a quantiser over the pixels. Three problems are baked into that.

1. **The colours are guesses.** Quantising pixels returns an approximation, not the value the site declared. You get `#f4932a` when the brand colour is a clean `#F4932A` — or something further off.
2. **It only sees the viewport.** Everything below the fold is invisible to it.
3. **It has no idea what anything is.** A screenshot cannot tell you that `#635BFF` is stored in `--blurple`, or that it paints 6.8% of the page.

Hexer reads the CSS instead.

The market leader charges $2.50/mo, $30/yr or $99 lifetime and requires an account — for a computation that runs entirely on your own machine in under a tenth of a second. This is that, for free.

## What it actually gives you

Measured on live sites, recorded in [`docs/verification.md`](docs/verification.md):

- **Exact declared values.** Never averaged, never approximated. Where two values sit within a hair of each other, the heavier one's literal hex survives — an average is a colour the site never wrote.
- **The variable name behind each colour.** 1,379 recovered on github.com, 437 on stripe.com, 296 on tailwindcss.com.
- **Completeness.** 204 distinct colours on tailwindcss.com, 98 on stripe.com — the whole page, not the visible slice.
- **Real dominance.** Each colour's share of *painted area*, so a 1px border used 640 times does not outrank one full-bleed hero.
- **Speed.** 17–113 ms across ten live sites.

Colours are grouped into **brand / text / surface / border**, and swatch size shows dominance within each group.

**On that grouping, plainly:** it sorts by saturation and prominence, and it is a convenience rather than a promise. On a site whose primary colour lives on a handful of small buttons while a decorative gradient covers half the page, the gradient ranks higher. Three of the ten sites tested have no single chromatic brand colour at all. Every colour is found and exact — which group it lands in is best-effort. The measured results, including where this falls short, are in [`docs/verification.md`](docs/verification.md).

## What it reads

`background-color`, `color`, all four `border-*-color`, `outline-color`, `column-rule-color`, `text-decoration-color`, `caret-color`, gradient colour stops, SVG `fill` and `stroke`, `::before` / `::after` pseudo-elements, open shadow DOM, and `--*` custom properties.

Modern colour syntax included — `oklch()`, `oklab()`, `lab()`, `lch()`, `color-mix()` — because every value is normalised through the browser's own parser rather than a hand-written one.

## Exports

Click any swatch to copy its hex. Or take the whole palette as:

- **CSS custom properties**, reusing the site's own variable names
- **Tailwind** `theme.colors` fragment
- **JSON**, with painted-area share, usage count and source breakdown per colour
- **PNG** or **JPEG** swatch sheet
- **Figma** — paste straight in as editable vector rectangles

A second tab quantises a screenshot, for colours that only exist inside logos and images.

## Privacy

Two permissions, total:

```json
"permissions": ["activeTab", "scripting"]
```

No `<all_urls>`, no host permissions, no storage, no background service worker. `activeTab` means Chrome shows **no permission warning at install**, and the extension can only see a page at the moment you click its icon.

There is no `fetch`, no `XMLHttpRequest`, no analytics and no storage anywhere in the source. There is also **no build step** — the published package is the source, so you can verify all of that by reading it directly rather than trusting a bundle.

## Install

**From the Chrome Web Store:** submission pending.

Until then, install it locally. It takes about a minute and works on Chrome, Edge, Brave, Arc and any other Chromium browser.

### Option A — download the release (no git needed)

1. Download **`hexer.zip`** from the [latest release](https://github.com/Gamaleldientarek/hexer/releases/latest).
2. Unzip it. You should end up with a folder containing `manifest.json`.
3. Open `chrome://extensions` in your browser.
4. Turn on **Developer mode** — the toggle is in the top-right corner.
5. Click **Load unpacked** and select the unzipped folder.
6. Hexer appears in your toolbar. Click the puzzle-piece icon and pin it.

### Option B — clone the repo

```bash
git clone https://github.com/Gamaleldientarek/hexer
cd hexer
```

Then follow steps 3–6 above, selecting the `hexer` folder.

Cloning is the better option if you want updates: `git pull`, then hit the refresh arrow on the Hexer card in `chrome://extensions`.

### Try it on

`tailwindcss.com` is the best first test — it declares 204 distinct colours in `oklab()`, which is exactly what screenshot-based tools cannot read. `stripe.com` shows off variable-name recovery, with 437 of them.

### Notes

- **Developer mode must stay on** for an unpacked extension to keep running. Chrome may show a "disable developer mode extensions" prompt on startup — dismiss it; that goes away once the store version is live.
- **There is no double-click installer.** Chrome permanently blocks `.crx` installs from outside the Web Store on macOS and Windows — no flag, no workaround. Load unpacked and the store are the only two routes for anyone.
- **Nothing is uploaded anywhere.** No account, no sign-in, no network calls at all.

## Development

```bash
npm install
npx playwright install chromium

npm test                         # 147 unit tests
npm run test:e2e                 # 30 browser tests
npm run icons                    # regenerate PNGs from icons/icon.svg
node scripts/verify-sites.mjs    # scan 10 live sites and report
```

No bundler, no transpiler. Plain ES modules, loaded directly by the popup.

## Known limits

Hexer cannot see:

- Cross-origin iframes, or closed shadow roots
- Colours that exist only inside images — use the **From images** tab for those
- Custom properties defined only under an inactive theme, e.g. `.dark { --bg: #000 }` while light mode is showing. Hexer reports the palette as currently rendered.
- Colours below the alpha threshold, or on elements with zero painted area

Pages above 20,000 elements are sampled, and the UI says so rather than pretending otherwise.

Cross-origin **stylesheets** are *not* a limitation, despite being the obvious guess: values and variable names come from computed styles, so origin is irrelevant. stripe.com blocks all five of its stylesheets and still yields 437 variables.

## Licence

MIT — see [LICENSE](LICENSE).

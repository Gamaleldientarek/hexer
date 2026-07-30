<div align="center">

# Hexer

**See the exact colors a website declares — read from its CSS, not guessed from a screenshot.**

One click. No account, no subscription, no server, no network calls.

[![Release](https://img.shields.io/github/v/release/Gamaleldientarek/hexer?color=F83200&label=release)](https://github.com/Gamaleldientarek/hexer/releases/latest)
[![Licence](https://img.shields.io/badge/licence-MIT-0055FF)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-178%20passing-2a2a2a)](docs/verification.md)
[![Size](https://img.shields.io/badge/size-29%20KB-2a2a2a)](#)
[![Tracking](https://img.shields.io/badge/tracking-none-2a2a2a)](#privacy)

Built by [gamaleldien.com](https://gamaleldien.com)

</div>

---

# ⬇️ Install

> **Submitted to the Chrome Web Store on 31 July 2026** — awaiting review.
> Installing locally takes about a minute and works on Chrome, Edge, Brave, Arc, and any other Chromium browser.

### ➊ Download

### **[⬇️ Download hexer.zip](https://github.com/Gamaleldientarek/hexer/releases/latest/download/hexer.zip)**

Then unzip it. You should end up with a folder containing `manifest.json`.

### ➋ Open the extensions page

Paste this into your address bar:

```
chrome://extensions
```

### ➌ Turn on Developer mode

The toggle is in the **top-right corner** of that page.

### ➍ Load it

Click **`Load unpacked`** — top-left — and select the unzipped folder.

### ➎ Pin it

Click the **puzzle-piece icon** in your toolbar, then the pin next to Hexer.

Done. Open any website and click the Hexer icon.

---

> ### 🎨 Try it on `tailwindcss.com` first
> It declares **204 distinct colors** in `oklab()` — precisely what screenshot-based tools cannot read.
> Then try **`stripe.com`**, where Hexer recovers **437 CSS variable names**.

---

<details>
<summary><b>Prefer to clone? (better for updates)</b></summary>

```bash
git clone https://github.com/Gamaleldientarek/hexer
cd hexer
```

Then follow steps ➋–➎ above, selecting the `hexer` folder.

To update later: `git pull`, then click the refresh arrow on the Hexer card in `chrome://extensions`.

</details>

<details>
<summary><b>Three things worth knowing</b></summary>

- **Developer mode must stay on** for any unpacked extension to keep running. Chrome may nag about this on startup — dismiss it. It stops once the store version is live.
- **There is no double-click installer, for anyone.** Chrome permanently blocks `.crx` installs from outside the Web Store on macOS and Windows — no flag, no workaround. Load unpacked and the store are the only two routes that exist.
- **Nothing is uploaded anywhere.** No account, no sign-in, no network calls at all. See [Privacy](#privacy).

</details>

---

## Why

Every color-palette extension I could find works the same way: it takes a **screenshot** of the page and runs a quantiser over the pixels. Three problems are baked into that.

1. **The colors are guesses.** Quantising pixels returns an approximation, not the value the site declared. You get `#f4932a` when the brand color is a clean `#F4932A` — or something further off.
2. **It only sees the viewport.** Everything below the fold is invisible to it.
3. **It has no idea what anything is.** A screenshot cannot tell you that `#635BFF` is stored in `--blurple`, or that it paints 6.8% of the page.

Hexer reads the CSS instead.

The market leader charges $2.50/mo, $30/yr or $99 lifetime and requires an account — for a computation that runs entirely on your own machine in under a tenth of a second. This is that, for free.

## What it actually gives you

Measured on live sites, recorded in [`docs/verification.md`](docs/verification.md):

- **Exact declared values.** Never averaged, never approximated. Where two values sit within a hair of each other, the heavier one's literal hex survives — an average is a color the site never wrote.
- **The variable name behind each color.** 1,379 recovered on github.com, 437 on stripe.com, 296 on tailwindcss.com.
- **Completeness.** 204 distinct colors on tailwindcss.com, 98 on stripe.com — the whole page, not the visible slice.
- **Real dominance.** Each color's share of *painted area*, so a 1px border used 640 times does not outrank one full-bleed hero.
- **Speed.** 17–113 ms across ten live sites.

Colors are grouped into **brand / text / surface / border**, and swatch size shows dominance within each group.

**On that grouping, plainly:** it sorts by saturation and prominence, and it is a convenience rather than a promise. On a site whose primary color lives on a handful of small buttons while a decorative gradient covers half the page, the gradient ranks higher. Three of the ten sites tested have no single chromatic brand color at all. Every color is found and exact — which group it lands in is best-effort. The measured results, including where this falls short, are in [`docs/verification.md`](docs/verification.md).

## What it reads

`background-color`, `color`, all four `border-*-color`, `outline-color`, `column-rule-color`, `text-decoration-color`, `caret-color`, gradient color stops, SVG `fill` and `stroke`, `::before` / `::after` pseudo-elements, open shadow DOM, and `--*` custom properties.

Modern color syntax included — `oklch()`, `oklab()`, `lab()`, `lch()`, `color-mix()` — because every value is normalised through the browser's own parser rather than a hand-written one.

## Exports

Click any swatch to copy its hex. Or take the whole palette as:

- **CSS custom properties**, reusing the site's own variable names
- **Tailwind** `theme.colors` fragment
- **JSON**, with painted-area share, usage count and source breakdown per color
- **PNG** or **JPEG** swatch sheet
- **Figma** — paste straight in as editable vector rectangles

A second tab quantises a screenshot, for colors that only exist inside logos and images.

## Privacy

Two permissions, total:

```json
"permissions": ["activeTab", "scripting"]
```

No `<all_urls>`, no host permissions, no storage, no background service worker. `activeTab` means Chrome shows **no permission warning at install**, and the extension can only see a page at the moment you click its icon.

There is no `fetch`, no `XMLHttpRequest`, no analytics and no storage anywhere in the source. There is also **no build step** — the published package is the source, so you can verify all of that by reading it directly rather than trusting a bundle.

Full [privacy policy](PRIVACY.md), including how to verify these claims yourself with three `grep` commands.

## Development

```bash
npm install
npx playwright install chromium

npm test                         # 147 unit tests
npm run test:e2e                 # 31 browser tests
npm run icons                    # regenerate PNGs from icons/icon.svg
node scripts/verify-sites.mjs    # scan 10 live sites and report
```

No bundler, no transpiler. Plain ES modules, loaded directly by the popup.

## Known limits

Hexer cannot see:

- Cross-origin iframes, or closed shadow roots
- Colors that exist only inside images — use the **From images** tab for those
- Custom properties defined only under an inactive theme, e.g. `.dark { --bg: #000 }` while light mode is showing. Hexer reports the palette as currently rendered.
- Colors below the alpha threshold, or on elements with zero painted area

Pages above 20,000 elements are sampled, and the UI says so rather than pretending otherwise.

Cross-origin **stylesheets** are *not* a limitation, despite being the obvious guess: values and variable names come from computed styles, so origin is irrelevant. stripe.com blocks all five of its stylesheets and still yields 437 variables.

## Building your own

Everything learned shipping this — the permission decision that sets your review
time, the injected-function pattern, how to test a popup without a store account,
and the browser behaviours that cost a day each — is written up in
[**docs/CHROME-EXTENSION-PLAYBOOK.md**](docs/CHROME-EXTENSION-PLAYBOOK.md).

## Credits

Designed and built by **Gamal Eldien Tarek** — [gamaleldien.com](https://gamaleldien.com).

Creative Director and brand strategist. Hexer came out of needing a site's real palette often enough to resent paying a subscription for an approximation of one.

## Licence

MIT — see [LICENSE](LICENSE).

Free to use, fork, and ship. If it saves you an afternoon, a link back to [gamaleldien.com](https://gamaleldien.com) is welcome but never required.

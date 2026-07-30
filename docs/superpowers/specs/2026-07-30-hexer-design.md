# Hexer — Design Spec

**Date:** 2026-07-30
**Status:** Approved for planning
**Owner:** Jimmy (Gamal Eldien)
**License:** MIT, public repo

---

## 1. Purpose

A Chrome extension that returns the **exact** color palette of any website by reading its CSS, ranked by how much of the page each color actually paints.

Free, open source, no account, no server, no network calls. One click, one popup, done.

### Why it exists

Site Palette (90,000 users, 3.8★) charges $2.50/mo–$99 lifetime and requires a MagicLink account for a job that is 100% local computation. Worse, all four of its algorithms run on a **screenshot** — it quantises pixels and never reads the code. So it returns approximated colors from the visible viewport only, with no variable names and no usage data.

Reading the CSS instead gives exact declared values, the whole page rather than the viewport, the custom-property name behind each color, and a real measure of dominance. That is the entire thesis.

### Success criteria

| # | Criterion | How it's verified |
|---|---|---|
| 1 | On 10 live sites: every color returned is an exact declared value, variable names are recovered where the site defines them, and neutrals never land in BRAND. Group *placement* of a primary brand color is best-effort, not guaranteed | `scripts/verify-sites.mjs`, results in `docs/verification.md`. **Originally specified as 'primary brand color in BRAND top 2'; that failed at ~3/10 and was found to be unachievable from CSS alone — see docs/verification.md** |
| 2 | Scan completes in < 400 ms on a ~5,000-element page | `stats.durationMs` asserted in e2e test |
| 3 | Zero permission warnings at install | Manual check on load-unpacked |
| 4 | Zero network requests at runtime | DevTools network tab + source inspection (no `fetch`/`XHR` exists in the codebase) |
| 5 | All fixture tests green | `npm test` |

---

## 2. Architecture

```
    user clicks toolbar icon
              │
              ▼
      ┌───────────────┐   scripting.executeScript({func})   ┌──────────────┐
      │     POPUP     │ ──────────────────────────────────▶ │  css-scan    │ in page
      │               │ ◀────────────────────────────────── │  (self-      │
      │  all UI       │      aggregated JSON, ~50–400 rows  │   contained) │
      │  all compute  │                                     └──────────────┘
      │               │
      │               │   tabs.captureVisibleTab()          ┌──────────────┐
      │               │ ──────────────────────────────────▶ │  pixel-scan  │ lazy
      │               │ ◀────────────────────────────────── │  OffscreenCa │
      └───────────────┘      8 quantised colors            │  nvas + MMCQ │
              │                                             └──────────────┘
              ▼
   parse → rank → cluster → roles → render          (pure, unit-tested)
              │
              └── clipboard · CSS/Tailwind/JSON · PNG/JPEG · SVG for Figma
```

**No service worker.** The popup is a real document with canvas and clipboard, and it can call both `scripting` and `tabs` directly. A background worker would add a lifecycle to manage and buy nothing.

**No build step.** MV3 popups support native ES modules (`<script type="module">`). The published package is the source, byte for byte. This also satisfies MV3's "full functionality must be easily discernible from the submitted code" requirement trivially, which keeps review in the fast lane.

---

## 3. Extraction — `src/scan/css-scan.js`

### Hard constraint

This file exports **one self-contained function** passed to `chrome.scripting.executeScript({ func })`. It cannot import anything and cannot reference outer scope — the function is serialised and injected. All its helpers are nested inside it. This is the one place in the codebase where we accept a larger single file.

### What it harvests

| Category | Properties |
|---|---|
| Fills | `background-color`, `background-image` gradient color stops |
| Text | `color`, `text-decoration-color`, `caret-color` |
| Edges | `border-{top,right,bottom,left}-color`, `outline-color`, `column-rule-color` |
| Vector | SVG `fill`, `stroke` |
| Pseudo | `::before` / `::after` computed styles |
| Components | Open `shadowRoot` subtrees, recursively |
| Declared | `--*` custom properties whose value resolves to a color |
| Free signal | `<meta name="theme-color">` |

### Custom-property names — two sources, either may fail

Chrome does **not** expose `--*` custom properties through `getComputedStyle` iteration (Safari and Firefox do). So:

1. **Primary:** walk `document.styleSheets`, read rules matching `:root`, `html`, `body`, `[data-theme]`, `[class*=theme]`, and collect declarations starting with `--` whose value parses as a color. Wrap every `.cssRules` access in `try/catch` — cross-origin sheets throw `SecurityError` and are skipped silently.
2. **Supplement:** `document.documentElement.computedStyleMap()` — Chrome's Typed OM does enumerate custom properties.

If both yield nothing, variable names are simply absent and the palette is still correct. The `--var` label is an enhancement, never a dependency. **Spike A resolves which source to trust.**

### Weighting — painted area, not occurrence count

Counting occurrences is wrong: a 1px border used 640 times is not more important than one full-bleed hero. Every color record carries a weight in square pixels.

```
area(el)     = max(0, rect.width × rect.height)
ownArea(el)  = max(0, area(el) − Σ area(child) for children with a non-transparent background-color)

background-color         →  ownArea(el)
background-image stop    →  ownArea(el) ÷ stopCount        (per stop)
color                    →  Σ over direct text children of: fontSize² × 0.5 × textLength
border-<side>-color      →  sideLength × borderWidth       (per side; skip if width 0 or style none)
outline-color            →  perimeter × outlineWidth
fill / stroke (SVG)      →  area(el)
text-decoration-color    →  fontSize × textLength × 0.08
caret-color              →  1                              (presence signal only)
box-shadow color        →  1                              (presence signal only)
```

`ownArea` subtracting opaque children is what stops a `<body>` background from being credited for the entire page when a hero covers it. It is an approximation of occlusion, not exact — exact occlusion is not worth the compute.

### Skip rules

Zero-area elements, `visibility: hidden`, `opacity < 0.05`, `<script>` / `<style>` / `<head>` subtrees, colors with alpha `< 0.05`, and `transparent`. `display: none` is excluded automatically by its zero rect.

### Performance budget

Hard cap of **20,000 elements**. Above that, walk every Nth element where `N = ceil(count / 20000)` and multiply weights by `N`, then set `truncated: true`. Pseudo-elements are only queried for elements with non-zero area. Closed shadow roots are inaccessible — a documented limitation. Cross-origin iframes are inaccessible — same.

### Return contract

Aggregated **in the page** before returning, keyed by `value|source`, which collapses ~50,000 raw rows to ~50–400.

```js
{
  ok: true,
  host: "stripe.com",
  meta:    { themeColor: "#0A2540" | null },
  vars:    [ { name: "--blurple", value: "#635BFF" } ],
  records: [ { value: "rgb(99, 91, 255)", source: "background-color", weight: 12043.5, count: 18 } ],
  stats:   { elements: 4821, truncated: false, durationMs: 214 }
}
```

`count` is not used by the ranking pipeline — weight is. It is carried through purely so the JSON export can report how many elements used each color.

---

## 4. Core pipeline — pure functions, fully unit-tested

Order is load-bearing.

```
parse.js    CSS color string → { r, g, b, a }. Handles hex 3/4/6/8, rgb(), rgba(),
            hsl(), hsla(), oklch(), color(), and named colors. Drops a < 0.05.

rank.js     Sums weights per color across all sources, normalises to weightPct
            (% of total painted area), retains the per-source breakdown.

cluster.js  Merges near-identical colors. Distance = Euclidean in OKLab,
            √(ΔL² + Δa² + Δb²) < CLUSTER_DELTA_E. The representative is the
            highest-weight member's EXACT declared value — never an average.
            Merged weights sum.

roles.js    Classifies into BRAND / TEXT / SURFACE / BORDER.
```

### `roles.js` rules — explicit, deterministic

```
1. Color matches <meta name="theme-color">          → BRAND   (forced)
2. Only edge sources (border-*/outline/column-rule)  → BORDER
3. Any text source (color/text-decoration/caret)     → TEXT
4. Otherwise (fill sources: background-color, gradient stop, fill, stroke):
      oklch.C ≥ CHROMA_BRAND_MIN and weightPct ≤ BRAND_AREA_MAX_PCT  → BRAND
      else                                                            → SURFACE
5. Tie-break when a color has both text and fill sources: assign to whichever
   source category contributed the larger share of its total weight.
```

Rule 4 encodes the actual definition of an accent: saturated *and* used sparingly. A saturated color covering 60% of the page is a surface, not an accent.

### `constants.js` — every tunable in one file

```js
CHROMA_BRAND_MIN    = 0.06    // OKLCH chroma floor for BRAND
BRAND_AREA_MAX_PCT  = 20      // above this, a saturated color is a SURFACE
CLUSTER_DELTA_E     = 0.02    // OKLab merge threshold
ELEMENT_CAP         = 20000   // sampling kicks in above this
PIXEL_SAMPLE_MAX    = 200     // downsample edge for pixel mode
PIXEL_COLOR_COUNT   = 8       // quantiser output size
```

These five numbers are starting values, tuned against the fixture suite. They live in one file precisely so tuning is a one-line change, not a hunt.

---

## 5. UI — `popup.html` + `src/popup/render.js`

**Direction B3, approved.** 400 px wide, grouped swatch board, **swatch size proportional to dominance within its group**.

```
┌────────────────────────────────────────────────┐
│ ▪  stripe.com                     24 colors   │
│ FROM CODE  ·  from images                      │
├────────────────────────────────────────────────┤
│ BRAND                                          │
│ ┌──────────────────────┐ ┌──────────┐          │
│ │       #635BFF        │ │ #0570DE  │          │
│ └──────────────────────┘ └──────────┘          │
│  #635BFF --blurple 6.8%   #0570DE 1.7%         │
│ TEXT                                           │
│ ┌──────────────────────┐ ┌──────────┐          │
│ │       #0A2540        │ │ #425466  │          │
│ └──────────────────────┘ └──────────┘          │
│  #0A2540 --dark 18.6%     #425466 5.1%         │
│ SURFACE  …   BORDER  …                         │
├────────────────────────────────────────────────┤
│ Copy all  CSS  Tailwind        PNG   Figma      │
└────────────────────────────────────────────────┘
```

### Sizing rule

A 6-column CSS grid per group, colors ordered by weight descending. Each color's column span:

```
share = color.weight ÷ group.totalWeight
span  = clamp(1, 4, Math.round(share × 6))
```

Spans are proportional to share **of the color's own group**, never of the whole palette.

**Sizing is per-group, never global.** Globally, white at 47% would swallow the popup and the brand color at 6.8% would be a speck — backwards, since the brand color is the payload. Within BRAND, the primary correctly outweighs the secondary.

### Chrome is greyscale — deliberate

Orange `#F83200` appears only on the brand mark, the active tab underline, and focus/selected states. No electric blue anywhere. A color tool with a colorful UI misreads its own swatches: surrounding hues shift perception. This is a functional constraint, not a stylistic one.

Type: **system fonts only** — system sans for labels, system mono for hex values. No Clash Display in the extension. The popup is almost entirely 9–12px labels, where a system UI face is more legible than a display face; bundling a webfont would add package weight and a redistribution-licence question for zero gain. Clash Display belongs on the landing page, not in the popup.

### Interaction

- Click any swatch → hex to clipboard, inline confirmation on the swatch.
- Tabs: **From code** (default, instant) · **From images** (lazy — pixel scan runs only on first click).

---

## 6. Outputs — `src/export/`

| Output | Mechanism |
|---|---|
| **Click swatch** | `navigator.clipboard.writeText(hex)`. No permission needed from a focused popup. |
| **Copy all → CSS** | `:root { --brand-1: #635BFF; … }`, reusing the site's own variable name where known, else `--{role}-{n}`. |
| **Copy all → Tailwind** | `colors: { brand: {…}, surface: {…} }` fragment. |
| **Copy all → JSON** | Full dump: hex, role, weightPct, variable name, source breakdown. |
| **PNG / JPEG** | `sheet.js` renders a 1200 px-wide swatch sheet to canvas (grid, hex labels, host, date) → `toBlob` → `<a download>`. No `downloads` permission needed. |
| **Figma** | `sheet.js` emits the same layout as SVG → clipboard as `text/plain`. ⌘V in Figma creates named vector rectangles. **Spike B** confirms this still works; fallback is `.svg` file download + drag, which always works. |

Figma *variables* would require shipping a companion Figma plugin. Out of v1.

---

## 7. Permissions & privacy

```json
"permissions": ["activeTab", "scripting"]
```

That is the complete list. No `host_permissions`, no `<all_urls>`, no `storage`, no `downloads`, no `clipboardWrite`, no background service worker.

Consequences:

- **Zero permission warnings at install.** `activeTab` shows none, and access is granted only by clicking the icon, expiring on navigation off-origin.
- **Fast-lane Web Store review.** Broad host permissions route to in-depth human review with multi-week waits; narrow `activeTab` MV3 extensions often clear in hours.
- **Privacy is structural, not promised.** There is no `fetch`, no `XMLHttpRequest`, no analytics, and no storage anywhere in the source. With no build step, a reviewer can confirm it by reading the source directly.

---

## 8. Error and edge states — all specified

| State | Behaviour |
|---|---|
| Restricted page (`chrome://`, Web Store, `about:`) | Detect via **injection failure**, not URL sniffing. Message: "Chrome blocks extensions on this page." |
| No colors found | "No colors found — the page may still be loading." + Retry button. |
| `truncated: true` | Footnote: "sampled 20,000 of N elements". |
| All stylesheets cross-origin | Variable-name labels absent; palette unaffected. No error shown. |
| `captureVisibleTab` rate limit (2/sec) | Images tab debounced, button disabled 600 ms after a capture. |
| Page with a single color | Renders one group. No empty-group headings ever render. |

---

## 9. Files

Every file has one job. The one exception is `css-scan.js`, which must be self-contained by injection constraint.

```
manifest.json
popup.html
popup.css
icons/                16 · 32 · 48 · 128
src/popup/            main.js · render.js
src/scan/             css-scan.js · pixel-scan.js
src/core/             parse.js · oklab.js · cluster.js · rank.js · roles.js · constants.js
src/export/           text.js · sheet.js
src/vendor/           quantize.js          (MMCQ, MIT, vendored)
tests/unit/           *.test.js
tests/fixtures/       *.html
tests/e2e/            scan.spec.js
package.json          devDependencies only: vitest, @playwright/test
LICENSE               MIT
README.md
.gitignore            includes .superpowers/
```

---

## 10. Testing

**TDD.** The core is pure functions and gets tests first.

### Unit — Vitest

`parse`, `oklab`, `cluster`, `rank`, `roles`, `export/text`. All the real logic lives here and none of it needs a browser.

### Integration — Playwright against fixtures with known answers

| Fixture | Asserts |
|---|---|
| `hero-dominant.html` | Full-bleed `#F83200` hero ranks first in BRAND |
| `vars-root.html` | `:root{--brand:#0055FF}` → variable name attached to the color |
| `nested-bg.html` | Parent background is **not** credited for area its opaque child covers |
| `gradient.html` | 3-stop gradient → all 3 colors found, each ⅓ of the element's area |
| `border-only.html` | Color used only as a 1px border → classified BORDER, sub-1% |
| `text-heavy.html` | Text color weight exceeds a small saturated box |
| `shadow-dom.html` | Colors inside an open shadow root are found |
| `cross-origin-css.html` | Remote stylesheet does not throw; palette still returned |
| `restricted.html` | Injection failure path renders the correct message |
| `perf-5k.html` | Generated 5,000-element page → `stats.durationMs` < 400 (success criterion 2) |

### Manual smoke

Load unpacked, run across 10 real sites, confirm success criterion 1 and record results in the README.

---

## 11. Risks

| Risk | Spike | Fallback if it fails |
|---|---|---|
| Chrome may not enumerate `--*` custom properties | **A** — test `computedStyleMap()` vs `styleSheets` walk on 5 real sites | No variable names. Palette still exact and correctly ranked. |
| Figma may no longer parse pasted SVG markup | **B** — paste a generated SVG into Figma | `.svg` file download + drag. 100% reliable. |
| `CHROMA_BRAND_MIN` / `BRAND_AREA_MAX_PCT` mis-tuned → brand colors misfiled | — | Tuned against the fixture suite; both live in `constants.js` as one-line changes. |
| Occlusion approximation over-credits a background | — | Accepted. Fixture `nested-bg.html` bounds the error. |
| Very large pages exceed the time budget | — | `ELEMENT_CAP` sampling, surfaced honestly as "sampled N of M". |

Both spikes take ~30 minutes and both degrade gracefully. Neither gates the build.

---

## 12. Out of scope for v1

Deliberately excluded. All cheap to add later; none is why this exists.

Adobe `.ase` export · SVG-file export as a first-class output · palette history · cloud sync · accounts · shareable links · Coolors / Google Art Palette integration · a companion Figma plugin for variables · WCAG contrast badges · full-page scroll-and-stitch capture · Firefox port · color-blindness simulation · palette editing.

---

## 13. Ship path

1. **Spikes A and B** — ~30 min, resolves two small decisions.
2. **Build and test** — TDD on the core, then scan, then UI, then exports.
3. **Verify** — full test suite green, manual smoke on 10 sites, success criteria checked.
4. **Publish source** — public GitHub repo, MIT.
5. **Web Store** — $5 one-time developer registration, submit the zipped folder. `activeTab`-only should mean a fast review.
6. **Landing page** on `gamaleldien.com` — pitch, screenshots, store button, repo link.

### Distribution constraint

The landing page **cannot install the extension.** Chrome permanently blocks `.crx` installs from outside the Web Store on macOS and Windows — no flag, no workaround. The site links to the store listing and the repo; the Web Store is the only real install route. A "load unpacked" path exists for developers only.

---

## 14. Decisions on record

| Decision | Choice | Why |
|---|---|---|
| Color source | CSS first, pixels as a second tab | Exact values, whole page, variable names, real dominance |
| Ranking metric | Painted-area share | Occurrence count over-weights borders and under-weights heroes |
| UI direction | B3 — grouped swatch board, size = dominance | Visual hierarchy readable before any number |
| Dominance sizing scope | Per group | Global sizing buries the brand color under white |
| Own UI color | Greyscale, orange accents only | A colorful UI distorts perception of the swatches |
| Outputs | Click-copy · CSS/Tailwind/JSON · PNG/JPEG · Figma via SVG | Exactly what was asked for; `.ase` and SVG-file dropped |
| Permissions | `activeTab` + `scripting`, nothing else | Zero install warnings, fast review, structural privacy |
| Background worker | None | Popup can do everything |
| Build step | None | Published package is the source; simplifies MV3 review |
| Name | Hexer | Short, says what it hands you |

---

## Addendum — what implementation changed (2026-07-30)

Recorded here so the spec does not read as if it predicted everything. Full
evidence in `docs/spikes.md` and `docs/verification.md`.

| Spec said | Reality | Why |
|---|---|---|
| Two custom-property sources: stylesheet walk primary, Typed OM supplement | **One source: `computedStyleMap()`.** Stylesheet walk deleted | Spike A: `rule.style` iteration returns zero custom properties on all five test sites, including three with no blocked stylesheets. `CSSStyleDeclaration` iteration exposes standard longhands only |
| Cross-origin stylesheets limit variable-name recovery | **Not a limitation at all** | Typed OM reads computed values; origin is irrelevant. stripe.com blocks 5/5 sheets and still yields 437 variables |
| BRAND = saturated **and** ≤20% of painted area | **Area cap removed.** Chroma alone decides membership | The hero fixture disproved it: a full-bleed brand hero is the brand color, not a surface. Area now orders within a group |
| `CHROMA_BRAND_MIN` = 0.06 | **0.08** | Measured: brand colors cluster 0.104–0.306, neutrals 0.000–0.037. Only `#0A2540` is borderline at 0.060, and it reads as a dark surface |
| `CLUSTER_DELTA_E` = 0.02 | **0.005** | Measured: one-step hex noise is 0.0014–0.004, but `#FFFFFF` vs `#F6F9FC` is 0.0199. At 0.02 those two fused — a visible error in a tool promising exact values |
| `<meta name="theme-color">` forced into BRAND | **Rule deleted** | theme-color tints the browser toolbar, nearly always the page background. It put `#FFFFFF` atop Figma's and Airbnb's brand groups |
| `parse.js` handles hex/rgb/hsl/oklch | **All values normalised through a 1×1 canvas in the scanner** | Chrome serialises modern color functions in their own space. On tailwindcss.com 222 of 225 distinct values arrived as `oklab()`/`lab()` and were rejected, returning 3 colors for a 2,287-element page. Now 204 |
| Median-cut quantiser | **Largest-gap split** | Median-of-count splits by pixel population, so on a page 90% white with a 10% accent the median lands inside the white cluster and never isolates the accent |
| Vendored MMCQ under `src/vendor/` | **Written in-house, `src/core/quantize.js`** | ~30 lines. No third-party licence travels with the extension |
| 16 source files | 17, plus `palette.js` composing the pipeline | Composition needed its own unit; the count is no longer stated anywhere |

### Still unverified

Success criterion 3, zero permission warnings at install, requires loading the
unpacked extension through Chrome's native file picker. That cannot be
automated and is Jimmy's to confirm.

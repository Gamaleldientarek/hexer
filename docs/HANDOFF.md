# Hexer — session handoff

**Last updated:** 31 July 2026
**Status:** v1.0.2 submitted to the Chrome Web Store, awaiting review.

---

## 1. Read this first — where the code lives

**Working copy: `~/dev/hexer`** ← the only source of truth for code.

**Not** `~/Documents/My Drive/.../Claude Code/Site-palette`. That folder holds an
early snapshot of the spec and plan from before the move and is **stale**. Do not
edit it. Everything current is at `~/dev/hexer` and on GitHub.

### Why it moved, and why it must stay moved

macOS TCC denies the Homebrew `node` binary write access under `~/Documents`.
`mkdir` from bash succeeds there, but `fs.mkdirSync` from Node fails with
`EPERM`, so `npm install` can never run in the Drive folder. Confirmed by direct
test: Node can write in `$HOME` and cannot write in `~/Documents`.

Independently, `node_modules` holds tens of thousands of files and Google Drive
would try to sync every one of them. Even with the permission fixed, building
there would be a mistake.

**Repo:** https://github.com/Gamaleldientarek/hexer (public, MIT)

---

## 2. What it is

A Chrome MV3 extension that extracts a website's exact color palette by reading
its CSS, rather than quantising a screenshot the way every competitor does.

- 14 source modules, no build step, no runtime dependencies, ~32 KB packaged
- 181 tests: 147 unit (Vitest), 34 browser (Playwright)
- 29 commits, all on `main`
- Two permissions: `activeTab`, `scripting`. Nothing else.

---

## 3. Commands

```bash
cd ~/dev/hexer

npm test                        # 147 unit tests
npm run test:e2e                # 34 browser tests
npm run build                   # assemble dist/ — the only folder to load unpacked
npm run zip                     # build + package hexer.zip for the store
npm run icons                   # regenerate PNGs from icons/*.svg
node scripts/verify-sites.mjs   # scan 10 live sites, print what was found
node scripts/store-shots.mjs    # regenerate store screenshots + promo tile
node scripts/screenshot.mjs foo # single popup screenshot into .design/
```

**Load unpacked from `~/dev/hexer/dist`, never the repo root.** Loading the root
made Chrome package `node_modules`, `tests` and `.git` — the extension reported
61.7 MB instead of 108 KB.

---

## 4. Architecture in one pass

```
popup click
   → chrome.scripting.executeScript(scanPage)   src/scan/css-scan.js
   → aggregated color records
   → buildPalette()                             src/core/palette.js
       parse → rank → cluster → roles
   → renderBoard()                              src/popup/render.js
   → exports                                    src/export/{text,sheet}.js
```

No service worker. The popup is a real document, so it does all UI and all
computation. `src/core/*` is pure and runs in Node, which is why 147 tests need
no browser.

**`css-scan.js` is the one file that may not import anything.** It is serialised
and injected via `executeScript({ func })`, so every helper nests inside it.

---

## 5. The constants, and why they are those numbers

All in `src/core/constants.js`. Every value was measured, not guessed. Changing
one without re-running `verify-sites.mjs` is how this regresses.

| Constant | Value | Why |
|---|---|---|
| `CHROMA_BRAND_MIN` | 0.08 | Brand colors measure 0.104–0.306 in OKLCH chroma; neutrals 0.000–0.037. `#0A2540` is the only borderline at 0.060 and reads as a dark surface |
| `CLUSTER_DELTA_E` | 0.005 | One-step hex noise is 0.0014–0.004. But `#FFFFFF` vs `#F6F9FC` is 0.0199 — the spec's original 0.02 fused them, a visible error |
| `ELEMENT_CAP` | 20000 | Above this the scan samples every Nth element and says so in the UI |
| `ALPHA_MIN` | 0.05 | Below this a color is invisible |
| `PIXEL_SAMPLE_MAX` | 200 | Longest edge of the downsampled screenshot |
| `PIXEL_COLOR_COUNT` | 8 | Quantiser output size |

---

## 6. Six bugs measurement caught that the design got wrong

Recorded so nobody reintroduces them. Full evidence in `docs/spikes.md` and
`docs/verification.md`.

1. **Custom properties.** The plan's primary source — walking `document.styleSheets`
   and iterating `rule.style` — returns **zero** custom properties on all five test
   sites, including three with no blocked stylesheets. `CSSStyleDeclaration`
   iteration exposes standard longhands only. `computedStyleMap()` is the sole
   working source. *Bonus: cross-origin stylesheets are therefore not a limitation
   at all — stripe.com blocks 5/5 sheets and still yields 437 variables.*

2. **Modern color syntax.** Chrome serialises `oklab()`, `lab()`, `lch()` and
   `oklch(0 0 none / .54)` in their own space. `parse.js` rejected all of them: on
   tailwindcss.com **222 of 225** distinct values failed and the scan returned 3
   colors for a 2,287-element page. Fixed by normalising every value through a 1×1
   canvas in `css-scan.js`, letting the browser do the conversion. **3 → 204.**

3. **`<meta name="theme-color">` was forced into BRAND.** That tag is the browser
   toolbar tint, nearly always the page background. It put `#FFFFFF` atop Figma's
   and Airbnb's brand groups. Rule deleted.

4. **The brand area cap.** The design required BRAND to be saturated *and* under
   20% of the page. A full-bleed orange hero then filed as a surface while a 100px
   chip was promoted to brand. Cap removed; chroma alone decides membership, area
   only orders within a group.

5. **The quantiser.** Textbook median cut splits at the median *index*, so on a
   page 90% white with a 10% accent the split lands inside the white cluster and
   never isolates the accent. Now splits at the largest gap.

6. **Popup layout.** Taller band spacing pushed the footer past Chrome's 600px
   popup ceiling, making the export buttons unreachable. Body is now a fixed flex
   column with only the board scrolling. There is an e2e test guarding this.

---

## 7. Known weakness — read before promising anything

**Brand-group placement is best-effort and the README says so.**

The original success criterion — "the site's primary brand color lands in the
BRAND group, top two, on 10 sites" — **failed at roughly 3 of 10** and was not
tunable. Ranking by element count instead was tested: it helps Linear, does
nothing for Figma or Spotify, and makes gamaleldien.com worse.

The criterion assumed every site has one objective primary brand color recoverable
from CSS. Three of the ten (Vercel, Notion, Figma) have no chromatic brand color at
all. The colors *are* found and exact — which group they land in is the soft part.

The claim was reframed to what is verified rather than relaxing the criterion.
**Do not re-tighten the marketing copy without redoing `verify-sites.mjs`.**

---

## 8. Chrome Web Store state

| | |
|---|---|
| Submitted | 31 July 2026, v1.0.2 |
| Account | Personal Google account (not `ccreative@azmx.sa`) |
| Trader status | **Non-trader** — keeps the postal address off the public listing |
| Expected review | 7–14 business days (new account) |
| Privacy policy URL | `https://github.com/Gamaleldientarek/hexer/blob/main/PRIVACY.md` |
| Category | Developer Tools |

Listing assets live in `docs/store/` — five 1280×800 screenshots plus
`promo-440x280.png`. Store icon is `icons/store-icon-128.png` (96×96 artwork,
16px transparent padding — **different from the toolbar icon**, which correctly
fills its frame).

### On approval

1. Add the store URL to `README.md` (replaces "submitted, in review")
2. Add it to the GitHub release description
3. Put it on gamaleldien.com

### On rejection

Paste the reason and fix. The justifications and single-purpose text are in the
conversation and in `PRIVACY.md`; both are solid. Most likely nits are screenshot
content or justification wording.

---

## 9. Open items

**Blocking nothing, in rough priority order:**

- [ ] Landing page on gamaleldien.com — the pre-mortem put discoverability, not
      quality, as the top risk to this ever being used
- [ ] Decide where to post it once live; store search alone will not carry it
- [ ] Move the privacy policy to `gamaleldien.com/hexer/privacy` if preferred
      (the GitHub URL is accepted and works — swap without resubmitting)
- [ ] `docs/spikes.md` Spike B (does Figma still parse pasted SVG?) is still
      unticked. The Figma export ships and is believed to work; the fallback if
      not is a one-line change to a `.svg` download

**Two decisions Jimmy has not made:**

- **Credit name.** LICENSE and README say "Gamal Eldien Tarek". Never confirmed
  whether he wants that, "Jimmy", or "Zone 99" publicly.
- **The green.** `verify-sites.mjs` reports `#40CE03` on 12 elements of
  gamaleldien.com, and no `#F83200` anywhere — closest orange is `#E16105`. His
  brand rule is no green, ever. Hexer found a live violation on its author's own
  site and it has not been addressed.

---

## 10. Conventions that matter

- **British English in prose, American in the product.** The extension, listing
  and UI strings say "color" because store search is literal and the CSS property
  is `color`. Docs prose remains British where it reads naturally.
- **The popup chrome is greyscale on purpose.** `#F83200` appears only on the
  mark, the active-tab underline and focus rings. A color tool with a colorful UI
  misreads its own swatches. Do not add a second hue.
- **Marketing surfaces may use brand color freely** — the greyscale rule is about
  the tool, not the listing.
- Commits end with the `Co-Authored-By: Claude` trailer.
- `.design/` is gitignored scratch; `docs/store/` is the committed deliverable.

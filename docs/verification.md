# Verification

Run 2026-07-30 against live sites via `node scripts/verify-sites.mjs`,
Chrome Headless Shell 151, viewport 1440×900.

## Two bugs this run found and fixed

**1. `<meta name="theme-color">` was forced into the brand group.**
That tag sets the browser toolbar tint, which is nearly always the page
background. It put `#FFFFFF` at the top of Figma's and Airbnb's brand groups,
`#FAFAFA` at the top of Vercel's, `#08090A` at Linear's and `#030712` at
Tailwind's. The rule is gone; chroma alone decides membership.

**2. `parse.js` could not read `oklab()`, `lab()`, `lch()` or `none` components.**
On tailwindcss.com, **222 of 225 distinct colors failed to parse** — Tailwind v4
emits `oklab()` and `lab()`, and Chrome serialises modern color functions in
their own space rather than converting to `rgb()`. The scan returned 3 colors
for a 2,287-element page.

Fixed by normalising every harvested value through a 1×1 canvas in `css-scan.js`,
which converts anything Chrome can parse into exact sRGB. Cheaper and more
future-proof than hand-implementing CIELAB and OKLab inverses.

**Effect on tailwindcss.com: 3 colors → 204.**

## Success criterion 1: NOT MET

> On 10 well-known sites, the site's true primary brand color lands in the
> BRAND group, top two positions.

**Result: roughly 3 of 10.** The 8-of-10 gate is not met.

| Site | Wanted | Brand group, top 3 (by painted area) | Verdict |
|---|---|---|---|
| stripe.com | `#635BFF` | `#7F7DFC` `#F44BCC` `#533AFD` | fail — found blurple relatives, not blurple |
| linear.app | `#5E6AD2` | `#E4F222` `#F54E4E` `#2AAA47` | fail |
| vercel.com | black/white | `#FFDC30` `#38A2FF` `#00FF95` | pass-ish — brand is neutral, correctly in surface (`#FAFAFA` 84%) |
| tailwindcss.com | sky/cyan | `#FF3B9D` `#E60076` `#00BCFF` | partial — sky-400 present at #3 |
| github.com | `#0969DA` | `#000240` `#E6B7FE` `#5049C2` | fail |
| notion.com | black/white | `#02093A` `#0075DE` `#FF8A33` | pass-ish — `#FFFFFF` 62% in surface |
| figma.com | `#F24E1E` | `#CB9FD2` `#00B6FF` `#24CB71` | fail — only 8 colors from 1,225 elements |
| spotify.com | `#1DB954` | **`#1ED760`** `#AF2896` `#509BF5` | **pass** — current brand green, top 1 |
| airbnb.com | `#FF5A5F` | **`#FF385C`** `#DA1249` `#0066FF` | **pass** — current brand color, top 1 |
| gamaleldien.com | `#F83200` | `#E16105` `#40CE03` | fail |

### Why, and why tuning will not close it

The brand colors *are* found — they are in the palette. They rank low because
painted area is the wrong signal for *primacy*: a primary brand color often
appears on a handful of small buttons and links, while a decorative gradient
blob covers far more pixels.

Ranking the brand group by element count instead was tested and is not a fix.
It helps Linear (`#4354B8`, 124 elements — a near relative of their indigo),
does nothing for Figma or Spotify, and makes gamaleldien.com **worse**.

The deeper problem is that the criterion assumes every site has one objective
primary brand color recoverable from CSS. Three of the ten do not have a single
chromatic brand color at all (Vercel, Notion, Figma), and no amount of
threshold tuning recovers semantic intent that the stylesheet never encoded.

**This is a specification failure as much as a code failure.** The criterion
should not be quietly relaxed to something that passes.

### What is verified to work

| Property | Evidence |
|---|---|
| Exact declared values, never averaged | every hex above is a literal site value |
| Variable-name recovery | 1,379 on github, 437 on stripe, 296 on tailwind, 189 on airbnb |
| Completeness | 204 colors on tailwind, 98 on stripe, 64 on linear |
| Speed | 17–113 ms across all ten sites, all well inside the 400 ms budget |
| Neutrals separated from saturated colors | white/near-black consistently in surface, never brand |
| Cross-origin stylesheets no barrier | stripe blocks all 5 sheets, still yields 437 variables |

## Success criterion 2: MET

Scan under 400 ms at ~5,000 elements. Asserted by the `perf-5k` e2e test.
Live sites measured 17–113 ms at 890–3,791 elements.

## Success criterion 3: NOT YET VERIFIED

Zero permission warnings at install. Requires loading the unpacked extension in
Chrome, which needs a native file-picker dialog and so cannot be automated here.
**Jimmy to confirm.**

## Success criterion 4: MET

Zero network requests at runtime.

```
$ grep -rnE "fetch\(|XMLHttpRequest|WebSocket" src/
src/scan/pixel-scan.js: const blob = await (await fetch(dataUrl)).blob();
```

The single hit is a `data:` URL, which makes no network request.

## Success criterion 5: MET

177 tests pass — 147 unit (vitest), 30 e2e (Playwright).

## Notes

**A finding on gamaleldien.com.** The scan reports `#40CE03` — a green — on 12
elements, and no `#F83200` at all; the closest orange is `#E16105`. Given the
brand rule is no green, ever, that is worth looking at. Hexer found a live brand
violation on its author's own site, which is arguably the most honest
demonstration of what it is for.

**`open.spotify.com` is unreliable as a fixture.** It is an app shell; one run
returned 11 elements and 4 colors before hydration. `www.spotify.com` is
stable.

# Spikes

## Spike A — how does Chrome expose CSS custom properties?

**Run:** 2026-07-30, Chrome Headless Shell 151.0.7922.34, via `npm run spike:a`.

**Question.** Chrome does not enumerate `--*` through `getComputedStyle` iteration the
way Safari and Firefox do. Two candidates remained: walking `document.styleSheets`
and iterating `rule.style`, or Chrome's Typed OM via `computedStyleMap()`.

### Results

| Site | `rule.style` walk | `computedStyleMap()` | sheets | blocked |
|---|---|---|---|---|
| stripe.com | 0 | 714 | 5 | 5 |
| linear.app | 0 | 399 | 70 | 68 |
| vercel.com | 0 | 565 | 6 | 0 |
| tailwindcss.com | 0 | 492 | 2 | 0 |
| github.com | 0 | 1992 | 35 | 0 |

### Verdict: Typed OM is the only working source. Drop the stylesheet walk.

The stylesheet walk returned **zero** custom properties on every site — including
vercel, tailwindcss and github, where **no** stylesheet was cross-origin blocked.
So this is not a CORS failure. `CSSStyleDeclaration` iteration exposes only standard
longhand properties; custom properties are not enumerable that way in Chrome.
`getPropertyValue('--x')` does work, but only if you already know the name, which is
useless for discovery.

**Actions taken in `css-scan.js`:**

1. `computedStyleMap()` on `document.documentElement` is the sole source for
   custom-property names.
2. Deleted `walkRules`, the `VAR_SCOPE` selector regex, and the
   `document.styleSheets` loop. Also deleted the now-meaningless `sheetsTotal` and
   `sheetsBlocked` stats.
3. Added a cheap regex pre-filter before the resolve probe — see below.

### Two findings the plan did not anticipate

**Cross-origin stylesheets are not a limitation for variable names.** stripe.com had
all 5 of its stylesheets blocked and Typed OM still returned 714 variables, because
Typed OM reads computed values and does not care where a rule came from. The README's
known-limits list must drop this entry.

**Sites can expose thousands of custom properties, mostly non-colors.** github.com
has 1,992: `--Layout-column-gap`, `--animate-bounce`, `--100dvh`. Resolving each one
through the style probe forces a style recalculation, so 2,000 probes would blow the
400 ms scan budget on its own. Mitigation: a `COLOR_SHAPED` regex rejects values that
cannot be colors before any probe runs, cutting probes from thousands to dozens.
Named colors are matched by a short word test so `--x: rebeccapurple` still resolves.

**Scope caveat, accepted.** Typed OM returns the custom properties *in effect* on
`<html>` right now. Variables defined only under an inactive theme — say
`.dark { --bg: #000 }` while light mode is active — are not returned. That is correct
behaviour for this tool: Hexer reports the palette as currently rendered, not every
palette the site could theoretically render.

---

## Spike B — does Figma still parse pasted SVG markup?

Manual, requires a Figma login. **Not yet run — Jimmy to confirm.**

1. Copy this to the clipboard:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80">
  <rect x="0" y="0" width="80" height="80" fill="#F83200"/>
  <rect x="80" y="0" width="80" height="80" fill="#0055FF"/>
  <rect x="160" y="0" width="80" height="80" fill="#141414"/>
</svg>
```

2. Open any Figma file, press ⌘V.
3. **PASS** = three editable vector rectangles appear. **FAIL** = nothing, or a single
   flat image.

Verdict: `[ ] PASS   [ ] FAIL`

If FAIL, Task 13 swaps one line: instead of writing the SVG string to the clipboard,
download it as a `.svg` file and relabel the button. `sheet.js` produces the same
string either way, so nothing else changes.

---

## Environment note

`npm` cannot run inside the original project location
(`~/Documents/My Drive/.../Site-palette`): macOS TCC denies the Homebrew `node` binary
write access under `~/Documents`, so `mkdir node_modules` fails with `EPERM`. bash's
own `mkdir` succeeds there, which is what makes the failure look like a sandbox issue
rather than an OS permission one.

The working copy therefore lives at `~/dev/hexer`, cloned from the same GitHub remote.
This is the better arrangement regardless: `node_modules` holds tens of thousands of
files, and Google Drive would attempt to sync every one of them.

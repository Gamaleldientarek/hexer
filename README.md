# Hexer

**Get the exact colour palette of any website — straight from its CSS.**

One click. No account, no subscription, no server, no network calls. Free and MIT.

> **Status: design spec complete, implementation not started.**
> The full design is at [`docs/superpowers/specs/2026-07-30-hexer-design.md`](docs/superpowers/specs/2026-07-30-hexer-design.md).
> Nothing is installable yet.

---

## Why

Every colour-palette extension I could find does the same thing: it takes a **screenshot** of the page and runs a quantiser over the pixels. That approach has three problems baked in.

1. **The colours are guesses.** Quantising pixels returns an approximation of a colour, not the value the site actually declared. You get `#f4932a` when the brand colour is a clean `#F4932A` — or something further off.
2. **It only sees the viewport.** Scroll-down content is invisible to it.
3. **It has no idea what anything is.** A screenshot can't tell you that a colour is the brand accent, or that it's stored in `--brand-primary`, or that it paints 6.8% of the page.

Hexer reads the CSS instead. That gives exact declared values, the whole page rather than the visible slice, the custom-property name behind each colour, and a real measure of how much of the page each one paints.

The market leader charges $2.50/mo, $30/yr or $99 lifetime and requires an account — for a computation that runs entirely on your own machine in under half a second. This is that, for free.

## What it does

- Reads `background-color`, `color`, all four `border-*-color`, `outline-color`, gradient colour stops, SVG `fill`/`stroke`, `::before`/`::after` pseudo-elements, open shadow DOM, and `--*` custom properties.
- Ranks colours by **painted area**, not occurrence count — because a 1px border used 640 times is not more important than one full-bleed hero.
- Groups them into **brand / text / surface / border**, with swatch size showing dominance within each group.
- Click a swatch to copy the hex. Copy the whole palette as CSS custom properties, a Tailwind fragment, or JSON. Export a PNG/JPEG swatch sheet, or paste straight into Figma.
- A second tab quantises a screenshot, for colours that only exist inside logos and images.

## Privacy

Two permissions, total:

```json
"permissions": ["activeTab", "scripting"]
```

No `<all_urls>`, no host permissions, no storage, no background worker. `activeTab` means Chrome shows **no permission warning at install**, and the extension can only see a page at the moment you click its icon.

There is no `fetch`, no `XMLHttpRequest`, no analytics and no storage anywhere in the source. There is also **no build step** — the published package is the source, so you can verify all of that by reading sixteen files rather than trusting a bundle.

## Roadmap

- [ ] Spike: confirm how Chrome exposes `--*` custom properties
- [ ] Spike: confirm Figma still parses pasted SVG markup
- [ ] Core pipeline — parse, rank, cluster, roles (TDD)
- [ ] CSS scanner + fixture suite
- [ ] Popup UI
- [ ] Exports
- [ ] Chrome Web Store submission

## Known limits

By design or by browser constraint, Hexer cannot see:

- Cross-origin iframes
- Closed shadow roots
- Colours inside cross-origin stylesheets *as variable names* (the resolved colours are still found)
- Colours below the alpha threshold, or on elements with zero painted area

Pages above 20,000 elements are sampled, and the UI says so rather than pretending otherwise.

## Licence

MIT — see [LICENSE](LICENSE).

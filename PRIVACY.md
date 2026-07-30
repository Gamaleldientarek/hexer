# Privacy Policy — Hexer

**Effective 30 July 2026.** Applies to the Hexer browser extension, all versions.

---

## The short version

Hexer collects nothing, stores nothing, and sends nothing anywhere.

Everything it does happens on your computer, in the moment you click its icon. There is no account, no server, no analytics, and no network connection of any kind. When you close the popup, nothing remains.

You do not have to take that on trust. Hexer ships without a build step, so the published package is the source code — you can read every line of it, and there is no bundler output hiding anything.

---

## What Hexer accesses

Hexer only does anything when **you click its toolbar icon**. It cannot see any page before that, and it cannot see any page after you navigate away.

When you click the icon on a page, Hexer reads:

| What | Why |
|---|---|
| The page's computed CSS — colors from backgrounds, text, borders, outlines, gradients, SVG fills and strokes, pseudo-elements, and CSS custom properties | This is the entire point of the extension: it is where the colors live |
| The page's hostname, e.g. `stripe.com` | Shown in the popup header, and used to name exported files |
| The size and position of elements on the page | To calculate how much of the page each color actually paints |
| A screenshot of the visible tab — **only if you click the "From images" tab** | To extract colors that exist only inside logos and images |

That is the complete list.

## What Hexer does not access

- Your browsing history
- Your bookmarks, cookies, passwords or saved form data
- Anything you type
- Any page you have not explicitly clicked the icon on
- Any other tab, window or browser profile
- Your identity, email, IP address or location
- Any file on your computer

## Where the data goes

Nowhere. It is processed in your browser's memory and discarded when you close the popup.

Specifically:

- **No network requests.** The extension contains no `fetch` to any server, no `XMLHttpRequest`, no WebSocket, and no tracking pixel. The single `fetch` call in the source operates on a `data:` URL, which is an in-memory string and never leaves the machine.
- **No storage.** Hexer does not use `chrome.storage`, `localStorage`, `sessionStorage`, IndexedDB or cookies. Nothing is written to disk. Close the popup and the palette is gone.
- **No analytics.** No usage statistics, no crash reporting, no telemetry, no third-party scripts.
- **No third parties.** Nobody else receives anything, because nothing is sent to anybody.
- **No sale of data.** There is no data to sell.

## About the screenshot

The "From images" tab uses Chrome's `captureVisibleTab` to take a picture of the visible part of the current tab. This sounds more invasive than it is, so to be exact:

- It only runs **when you click that tab**. It never runs when the popup opens.
- The image is decoded in memory, shrunk to at most 200 pixels on its longest edge, and reduced to a handful of average colors.
- The image is **never saved to disk and never transmitted**. It exists only as a variable, and is discarded immediately.
- If you never click "From images", no screenshot is ever taken.

## Clipboard and downloads

- **Clipboard.** When you click a swatch or an export button, Hexer writes to your clipboard: a hex code, a CSS block, a Tailwind fragment, JSON, or SVG. It only ever writes. It never reads your clipboard.
- **Downloads.** The PNG and JPG buttons generate an image in memory and save it through your browser's normal download flow, only when you click them. The file is created locally; nothing is uploaded to produce it.

## Permissions, and why each one exists

Hexer requests two permissions. That is the complete manifest.

**`activeTab`** — grants temporary access to the single tab you are looking at, and only at the moment you click the extension icon. Access ends when you navigate away. This is why Chrome shows **no permission warning** when you install Hexer: it cannot read your data on all sites, because it was never given that ability.

**`scripting`** — allows Hexer to run its color-reading function inside that one tab so it can inspect the page's styles.

Hexer deliberately does **not** request: `<all_urls>` or any host permission, `storage`, `cookies`, `history`, `tabs` (beyond what `activeTab` grants), `downloads`, `identity`, or a background service worker.

## Chrome Web Store data disclosures

For transparency, this is what is declared on the Web Store listing:

| Category | Declared |
|---|---|
| Personally identifiable information | Not collected |
| Health information | Not collected |
| Financial and payment information | Not collected |
| Authentication information | Not collected |
| Personal communications | Not collected |
| Location | Not collected |
| Web history | Not collected |
| User activity | Not collected |
| **Website content** | **Accessed** — read locally to extract colors. Never collected, stored or transmitted |

Hexer complies with the Chrome Web Store Limited Use requirements: data is used solely for the single user-facing purpose of displaying a page's color palette, is never transferred to anyone, is never used for advertising, and is never read by any person — because it never leaves your device for anyone to read.

## Children

Hexer is a developer and design tool. It collects no data from anyone, of any age.

## Changes

If this policy ever changes, the revision will be committed to the public repository, so the full history of what this document has ever said is permanently auditable. Material changes will be noted in the release notes for the version they ship with.

## Contact

Questions, or something here that does not match what the code does?

- Open an issue: https://github.com/Gamaleldientarek/hexer/issues
- Website: https://gamaleldien.com

## Verify it yourself

You do not need to believe any of this. Check it:

```bash
git clone https://github.com/Gamaleldientarek/hexer
cd hexer

# every network primitive in the source
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" src/

# every storage primitive
grep -rnE "chrome\.storage|localStorage|sessionStorage|indexedDB|document\.cookie" src/

# every Chrome API the extension calls
grep -rhoE "chrome\.[a-zA-Z.]+\(" src/ | sort -u
```

At the time of writing, the first command returns a single `fetch` on a `data:` URL, the second returns nothing at all, and the third returns exactly three entries: `chrome.scripting.executeScript`, `chrome.tabs.captureVisibleTab`, and `chrome.tabs.query`.

---

Hexer is free and open source under the MIT licence, built by [Gamal Eldien Tarek](https://gamaleldien.com).

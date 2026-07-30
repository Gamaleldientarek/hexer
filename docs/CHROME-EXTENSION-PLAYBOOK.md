# Building a Chrome extension — a playbook

Written after shipping [Hexer](https://github.com/Gamaleldientarek/hexer) from
empty folder to Web Store submission in a day. Everything here is something that
actually cost time or would have, not a restatement of Chrome's docs.

Hexer is the worked example throughout, so every pattern below points at real
code you can read.

---

## 0. Before any code — three decisions that shape everything

### Do you need a service worker?

Probably not. A popup is a real document with DOM, canvas, clipboard, and access
to `chrome.tabs` and `chrome.scripting`. If all the work happens while the popup
is open, do it there and skip the background worker entirely — it has a lifecycle
that gets terminated and restarted, and debugging that is a tax you can decline.

Add one only for: context menus, keyboard commands that work without the popup,
alarms, or long-running work that must survive the popup closing.

### What is your permission budget?

**This is the single highest-leverage decision in the whole project**, because it
sets your review time and your install conversion.

| Permission | Install warning | Review lane |
|---|---|---|
| `activeTab` + `scripting` | **none** | fast |
| any `host_permissions` / `<all_urls>` | "read and change your data on all sites" | in-depth human review, multi-week |

`activeTab` grants access to one tab, at the moment the user clicks your icon,
expiring when they navigate away. It covers far more than people assume — it is
enough for anything that reacts to an explicit user action.

Reach for host permissions only when you genuinely need to act on pages the user
has not invoked you on. If you are unsure, you do not need them.

### Will you have a build step?

Prefer not to. MV3 popups support native ES modules:

```html
<script type="module" src="src/popup/main.js"></script>
```

No bundler means the published package **is** the source. That satisfies MV3's
"full functionality must be discernible from the submitted code" requirement
trivially, makes review easier, and lets you tell users to read the code rather
than trust a bundle. Hexer ships 14 modules this way at 32 KB.

---

## 1. Skeleton

```
manifest.json
popup.html
popup.css
icons/          icon.svg + 16/32/48/128 png, plus store-icon-128.png
src/
  popup/        main.js (wiring only) · render.js (DOM building)
  core/         pure functions — no DOM, no chrome APIs
  scan/         anything injected into pages
  export/       output formats
tests/
  unit/         vitest, runs in node
  e2e/          playwright
  fixtures/     known-answer HTML pages
scripts/        build, icons, screenshots, one-off probes
```

**The `core/` boundary is the important one.** Keep every piece of real logic in
pure functions that take data and return data. They then run in Node with no
browser, which is why Hexer has 147 unit tests that execute in under a second.
Anything touching `chrome.*` or `document` goes in `popup/` or `scan/` and gets
tested with Playwright instead.

### A minimal manifest

```json
{
  "manifest_version": 3,
  "name": "Name — What It Does In Search Terms",
  "version": "1.0.0",
  "description": "One sentence, under 132 characters.",
  "homepage_url": "https://yoursite.com",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Tooltip text",
    "default_icon": { "16": "icons/icon16.png", "32": "icons/icon32.png" }
  },
  "icons": {
    "16": "icons/icon16.png", "32": "icons/icon32.png",
    "48": "icons/icon48.png", "128": "icons/icon128.png"
  }
}
```

---

## 2. Always build to a `dist/` folder

**Do not load unpacked from your repo root.** Chrome packages the entire folder —
`node_modules`, `tests`, `docs`, `.git`. Hexer reported **61.7 MB** instead of
108 KB before this was caught.

```json
"scripts": {
  "build": "rm -rf dist && mkdir -p dist && cp -R manifest.json popup.html popup.css icons src dist/ && find dist -name '.DS_Store' -delete",
  "zip":   "npm run build && rm -f ext.zip && cd dist && zip -qr ../ext.zip . && cd .."
}
```

Zip **from inside** `dist`, so `manifest.json` sits at the archive root. A wrapper
folder inside the zip is rejected by the store.

Load unpacked from `dist/`, upload the zip from the same build. Local and store
then run identical bytes.

---

## 3. Reading a page: the injected-function pattern

```js
// src/scan/scan.js
export function scanPage({ someOption }) {
  // CONSTRAINT: this is serialised and injected. It may not import anything or
  // reference outer scope. Every helper nests inside it.
  const helper = (x) => x * 2;
  return { ok: true, data: helper(21) };
}
```

```js
// src/popup/main.js
import { scanPage } from '../scan/scan.js';

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

let injected;
try {
  injected = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scanPage,
    args: [{ someOption: 1 }],
  });
} catch (e) {
  // Injection failure is how you detect a restricted page. Do NOT sniff the URL
  // for chrome:// — that misses the Web Store, other extensions' pages and more.
  return { error: 'Chrome blocks extensions on this page.' };
}

const result = injected?.[0]?.result;
```

Because the function is self-contained, **Playwright can execute the exact same
function** with `page.evaluate(scanPage, args)`. Your e2e tests then exercise
production code rather than a copy of it.

---

## 4. Testing without a store account

You cannot automate Chrome's native file picker, so you cannot script "load
unpacked". You can still test almost everything.

**Serve the popup over HTTP and stub `chrome`.** ES modules are CORS-blocked on
`file://`, so a real origin is required:

```js
import { createServer } from 'node:http';
// ...serve repo root, then:

await page.addInitScript((cannedResult) => {
  window.chrome = {
    tabs: { query: async () => [{ id: 1 }] },
    scripting: { executeScript: async () => [{ result: cannedResult }] },
  };
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (t) => { window.__copied.push(t); } },
  });
}, CANNED);

await page.goto(origin + '/popup.html');
```

This gets you real rendering, real export logic, real error states and real
clipboard assertions. Hexer runs 34 browser tests this way.

**Generate test images rather than hardcoding base64.** A hand-pasted 1×1 PNG
that is subtly malformed will fail decoding and look like a code bug. Draw one
with a canvas in the page instead — and you can assert the exact colors back.

---

## 5. Things that will cost you a day if nobody tells you

**Chrome does not enumerate CSS custom properties via `getComputedStyle`.**
Safari and Firefox do. Iterating `rule.style` over `document.styleSheets` returns
**zero** custom properties in Chrome — it exposes standard longhands only. Use
`element.computedStyleMap()`. Bonus: it reads computed values, so cross-origin
stylesheets are not a barrier.

**Modern color functions are not serialised as `rgb()`.** Chrome hands back
`oklab()`, `lab()`, `lch()` and `oklch(0 0 none / .54)` verbatim. If you parse
colors by hand you will silently drop most values on any Tailwind v4 site. Let
the browser convert instead:

```js
const c = document.createElement('canvas');
c.width = c.height = 1;
const ctx = c.getContext('2d', { willReadFrequently: true });

const toRgb = (value) => {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = value;      // browser parses ANY valid CSS color
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
};
```

**Popups are capped at 600px tall.** Content past that is unreachable unless the
body is a flex column with a scrolling middle:

```css
body { max-height: 600px; display: flex; flex-direction: column; }
header, footer { flex: none; }
main { flex: 1 1 auto; overflow-y: auto; }
```

**`captureVisibleTab` is capped at 2 calls per second** and needs `activeTab`.
Debounce it, and run it lazily — never on popup open.

**`fetch()` on a `data:` URL makes no network request.** Useful for decoding a
screenshot, and worth a code comment so nobody reading your source thinks you
phone home.

**The clipboard works from a popup with no permission.**
`navigator.clipboard.writeText()` is fine. `clipboardWrite` is only for
background contexts.

**Downloads need no permission either.** A blob URL on `<a download>` works.

---

## 6. Icons — two different files, two different rules

| | Toolbar icons | Store icon |
|---|---|---|
| Sizes | 16, 32, 48, 128 | 128 only |
| Artwork | fills the frame | **96×96 inside a 128×128 canvas, 16px transparent padding** |
| Edges | fine | no edge at the canvas boundary — the store UI adds its own |
| Other | — | must read on light *and* dark; add a faint light ring if dark |

An icon with no alpha channel gets force-framed with a 12px corner radius by the
store. Keep the alpha.

Generate both from SVG with Playwright rather than adding an image library —
you already have it as a dev dependency for tests:

```js
const page = await browser.newPage({ viewport: { width: size, height: size } });
await page.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px}</style>${svg}`);
writeFileSync(`icons/icon${size}.png`, await page.screenshot({ omitBackground: true }));
```

---

## 7. Store submission checklist

Everything below is required. Missing any one blocks publishing.

- [ ] **Privacy policy at a public URL.** Mandatory for any extension that
      *handles* user data — **including locally-only processing**. Reading page
      content counts. A GitHub file URL is accepted:
      `github.com/you/repo/blob/main/PRIVACY.md`
- [ ] **Single purpose statement** — one sentence, on the Privacy practices tab
- [ ] **A justification per permission**, on the same tab. Say what it does for
      the user and why a narrower option would not work
- [ ] **Remote code declaration** — answer "No" if all your JS ships in the
      package. No CDN, no `eval`
- [ ] **Data disclosures** — tick only what applies. Reading page content is
      "Website content"
- [ ] **Three Limited Use certifications**
- [ ] **Store icon** 128×128 with the padding above
- [ ] **1–5 screenshots at 1280×800**
- [ ] **Small promo tile 440×280**
- [ ] **Category** — pick where your buyer browses, not where you'd file it
- [ ] **Trader / non-trader declaration** (EEA). Trader publishes your **postal
      address publicly**. Read the rules before choosing
- [ ] **$5 one-time developer fee**, covers 20 extensions

**Save Draft before switching tabs.** It is easy to lose a tab's worth of input.

**Expect 7–14 business days on a new account.** Established accounts with narrow
permissions often clear in hours.

---

## 8. Screenshots that are honest and still good

Render your **real UI** against **real data** and composite it into the 1280×800
frame programmatically. Then the screenshots are reproducible, regenerate in one
command, and cannot drift from the product.

Choose your demo subject deliberately, and check it. Hexer's first hero used
stripe.com, whose output happened to be twenty near-identical gradient stops — it
photographed as noise. basecamp.com carried every group with named variables and
told the story properly. That is photographing the product in good light, which
is fair; staging output it cannot produce is not.

---

## 9. Environment, on a Mac

**Do not put the project in `~/Documents` or any cloud-synced folder.** On macOS,
TCC can deny the Homebrew `node` binary write access under `~/Documents`, so
`npm install` fails with `EPERM` — while bash's own `mkdir` succeeds in the same
directory, which makes it look like anything but a permission problem. And
`node_modules` is tens of thousands of files that a sync client will grind on.

Use `~/dev/<name>` and push to git.

---

## 10. Sequence that worked

1. Decide permissions, service worker, build step *(section 0)*
2. Spike anything the design assumes about browser behaviour — **before** writing
   code around it. Two 30-minute probes saved a rewrite on Hexer
3. Build `core/` first, TDD, pure functions, no browser
4. Add the injected scanner with fixture-based Playwright tests
5. Shell: manifest, popup, wiring — get one end-to-end result on screen
6. UI, then exports
7. Error states: restricted page, empty result, rate limits
8. Icons, screenshots, promo tile
9. Privacy policy
10. Submit

Steps 2 and 3 are the ones people skip, and they are where the leverage is. On
Hexer, six design assumptions turned out to be wrong — every one was caught by a
test or a live-site run rather than by review, and each would have been a bug
report otherwise.

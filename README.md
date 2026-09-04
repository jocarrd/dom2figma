# dom2figma

Turn a live web page into **editable Figma layers** — frames, rectangles and real text nodes, with the colours, radii, borders, shadows and typography the browser actually computed.

Not a screenshot. Not a hosted service. It drives your own headless Chrome, so there is no per-import quota and nothing leaves your machine except the page you asked for.

```bash
npx dom2figma https://example.com
# → out/example-com.figma.json   ← paste into the bundled Figma plugin
```

## Where it comes from

This started as a skill for a coding agent. I wanted to say *"take the current site into Figma"* to Claude Code and have it happen — every route, desktop and mobile, light and dark — so that the Figma file was an honest mirror of what was in production, and design work could start from there instead of from memory.

Every existing web-to-Figma plugin renders your page **on someone else's servers** and meters it: ten imports a month on one, one on another, then a paywall. But if you have Chrome on your laptop, you already own the renderer. So the metered part is the part you do not need.

Hence two halves that stay decoupled: a **capture** step that is just Chrome and the DOM, and a **build** step that is just the Figma Plugin API. Anything can sit in between — a CLI, a script, or an agent working through fifty routes without a human clicking anything.

## What you get

| Captured | Notes |
| --- | --- |
| Layout | Absolute page coordinates, pre-ordered so stacking is preserved |
| Fills, borders, radii | Per-corner radii; any CSS colour syntax, including `color(srgb …)` and `oklab()` |
| Shadows | First `box-shadow` layer, as a Figma drop shadow |
| Text | Real editable text nodes, positioned by the glyph run rather than the element box |
| Typography | Family, weight, size, line height, letter spacing, alignment, underline, `text-transform` |
| Images | `<img>` and `background-image`, loaded into Figma by URL |
| Themes | `prefers-color-scheme` emulation, so you can capture light and dark |
| Viewports | Any width; below 500px it turns on mobile emulation |

**What it does not do:** auto-layout, component instances, or variable bindings. Those encode design intent that is not recoverable from a rendered page. Rebuild them by hand on the screens you actually plan to redesign — this gives you an accurate starting point, not a finished design system.

## Install

Requires **Node 22+** (for the global `WebSocket`) and a Chrome or Chromium binary. No npm dependencies.

```bash
npx dom2figma <url> [options]
# or
git clone https://github.com/jocarrd/dom2figma && cd dom2figma && node src/cli.mjs <url>
```

## Using it

### 1. Capture

```bash
npx dom2figma https://example.com --name "Home · desktop"
```

Three files land in `out/`:

| File | What it is |
| --- | --- |
| `<slug>.json` | the raw captured layout, if you want to post-process it |
| `<slug>.figma.json` | the payload for the bundled plugin — this is the one you normally use |
| `<slug>.figma.js` | a standalone script, for plugins that evaluate JavaScript |

### 2. Build it in Figma

Import the plugin once: **Plugins → Development → Import plugin from manifest…** and pick `figma-plugin/manifest.json`.

Run it, paste the contents of `<slug>.figma.json`, press **Build**. The frame appears on the page you named, at the coordinates you gave, and Figma zooms to it.

If you would rather not import a plugin, `<slug>.figma.js` runs in anything that evaluates JavaScript with `figma` in scope — [Scripter](https://www.figma.com/community/plugin/757836922707087381) is the usual choice. Paste and run.

### 3. Variants

The point of a mirror is that it covers everything, so capture the same route more than once:

```bash
# mobile
npx dom2figma https://example.com --width 390 --name "Home · mobile"

# dark
npx dom2figma https://example.com --theme dark --name "Home · dark"

# placed deliberately on the canvas, on its own page
npx dom2figma https://example.com --page "Screens" --at 3400,0
```

Give each route its own `x` column (page width plus a gap) and each theme its own `y` band, well below the tallest page. The frame name is the label you will read on the canvas, so make it say the route: `03 · /pricing — mobile dark`.

### 4. Things that will get in your way

**Cookie banners.** They sit on top of every capture. Find the key the site stores consent under and set it before the page runs:

```bash
npx dom2figma https://example.com --local-storage cookie-consent=all
```

**Pages behind a login.** Start a Chrome that already has your session and point at it — nothing is copied, it uses that browser:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/profile
npx dom2figma https://example.com/dashboard --endpoint http://127.0.0.1:9222
```

**Slow pages.** The capture scrolls to the bottom and back to trigger lazy loading, then waits. Data-heavy pages may need longer: `--settle 15000`.

### All options

| Option | Default | |
| --- | --- | --- |
| `--out <dir>` | `out` | where to write the output files |
| `--name <name>` | the URL | frame name in Figma |
| `--page <name>` | `dom2figma` | Figma page; created if missing |
| `--width <px>` | `1440` | viewport width; `<500` enables mobile emulation |
| `--theme <light\|dark>` | `light` | emulated `prefers-color-scheme` |
| `--at <x,y>` | `0,0` | position on the Figma canvas |
| `--endpoint <url>` | launches its own | CDP endpoint of an existing Chrome |
| `--settle <ms>` | `9000` | wait after load before extracting |
| `--local-storage <k=v>` | — | set before any page script runs; repeatable |
| `--json-only` | — | write only the raw layout JSON |

## With a coding agent

`skill/SKILL.md` is a [Claude Code](https://claude.com/claude-code) skill. Drop it in your skills directory and the agent can take a whole site into Figma on its own: it knows to capture each route in every viewport and theme, to lay the frames out on a grid, to suppress the cookie banner first, and to verify each capture rather than assume it worked.

The same file reads perfectly well as a runbook if you are doing it by hand.

## As a library

```js
import { capture, toPayload, launchChrome } from 'dom2figma'

const chrome = await launchChrome()
const layout = await capture('https://example.com', {
  endpoint: chrome.endpoint,
  width: 390,
  theme: 'dark',
  localStorage: { 'cookie-consent': 'all' }
})
const payload = toPayload(layout, { name: 'Home · mobile dark', x: 0, y: 0 })
chrome.stop()
```

`capture()` returns plain JSON, so you can filter, rename or re-map it before it reaches Figma. `toPayload()` accepts a `fontMap(family, weight)` when your Figma file uses different families than the site.

`examples/batch.mjs` captures many routes, viewports and themes in one resumable run.

## Licence

MIT © Jorge Carrera Díez

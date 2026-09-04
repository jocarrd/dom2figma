# dom2figma

Turn a live web page into **editable Figma layers** — frames, rectangles and real text nodes, with the colours, radii, borders, shadows and typography the browser actually computed.

Not a screenshot. Not a hosted service. It drives your own headless Chrome, so there is no per-import quota and nothing leaves your machine except the page you asked for.

```bash
npx dom2figma https://example.com
# → out/example-com.figma.json   ← paste into the bundled Figma plugin
```

## Why this exists

The existing web-to-Figma plugins render your page **on their servers** and charge for it — that is the part that costs them money. If you already have Chrome on your laptop, you already have the renderer. This project is the other 400 lines.

It was also built to be driven by a coding agent, not by a human clicking through a plugin UI: give it a URL, get a Figma frame. See [`skill/`](skill/) for the Claude Code skill.

## What you get

| Captured | Notes |
| --- | --- |
| Layout | Absolute page coordinates, pre-ordered so stacking is preserved |
| Fills, borders, radii | Per-corner radii; any CSS colour syntax |
| Shadows | First `box-shadow` layer, as a Figma drop shadow |
| Text | Real editable text nodes, measured with a `Range` so padding does not shift them |
| Typography | Family, weight, size, line height, letter spacing, alignment, underline, `text-transform` |
| Images | `<img>` and `background-image`, loaded into Figma by URL |
| Themes | `prefers-color-scheme` emulation, so you can capture light and dark |
| Viewports | Any width; below 500px it turns on mobile emulation |

**What it does not do:** auto-layout, component instances, or variable bindings. Those encode design intent that is not recoverable from a rendered page — rebuild them by hand on the screens you actually plan to redesign. This gives you an accurate starting point, not a finished design system.

## Install

Requires **Node 22+** (for the global `WebSocket`) and a Chrome or Chromium binary. No npm dependencies.

```bash
npx dom2figma <url> [options]
# or
git clone https://github.com/jocarrd/dom2figma && cd dom2figma && node src/cli.mjs <url>
```

## Usage

```bash
# desktop, light
npx dom2figma https://example.com --name "Home · desktop"

# mobile, dark, placed at x=2000 on a page called "Screens"
npx dom2figma https://example.com \
  --width 390 --theme dark --page "Screens" --at 2000,0

# skip a cookie banner that would otherwise cover every capture
npx dom2figma https://example.com --local-storage cookie-consent=all

# reuse a Chrome you already have listening (keeps your session cookies)
npx dom2figma https://example.com --endpoint http://127.0.0.1:9222
```

| Option | Default | |
| --- | --- | --- |
| `--out <dir>` | `out` | where to write the three output files |
| `--name <name>` | the URL | frame name in Figma |
| `--page <name>` | `dom2figma` | Figma page; created if missing |
| `--width <px>` | `1440` | viewport width; `<500` enables mobile emulation |
| `--theme <light\|dark>` | `light` | emulated `prefers-color-scheme` |
| `--at <x,y>` | `0,0` | position on the Figma canvas |
| `--endpoint <url>` | launches its own | CDP endpoint of an existing Chrome |
| `--settle <ms>` | `9000` | wait after load before extracting |
| `--local-storage <k=v>` | — | set before any page script runs; repeatable |
| `--json-only` | — | write only the raw layout JSON |

### Getting it into Figma

**With the bundled plugin (recommended).** In Figma: *Plugins → Development → Import plugin from manifest…* and pick `figma-plugin/manifest.json`. Run it, paste the contents of `<slug>.figma.json`, press **Build**.

**Without it.** `<slug>.figma.js` is a standalone script for any plugin that evaluates JavaScript with `figma` in scope — [Scripter](https://www.figma.com/community/plugin/757836922707087381) works well. Paste and run.

## Use as a library

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

`capture()` returns a plain JSON tree, so you can filter, rename or re-map it before it reaches Figma. `toPayload()` accepts a `fontMap(family, weight)` if your Figma file uses different families than the site.

## Three things that are easy to get wrong

Worth knowing if you ever build something similar.

**Modern CSS colours are not `rgb()`.** Tailwind v4 emits `color(srgb …)` and `oklab(…)`, so a regex over `rgba?\(…\)` silently drops most of the page — in one real capture, 6 backgrounds out of 1152. Painting the colour into a 1×1 canvas and reading the pixel back makes the browser do the conversion for every syntax it supports.

**The element box is not the text box.** A padded nav link centres its text vertically; place the text at the element's top-left and every nav item drifts upward. Measuring the glyph run with a `Range` fixes it.

**Figma's text metrics are not the browser's.** A single-line run given a fixed width can wrap in Figma where it never wrapped in Chrome. Single-line runs get an auto width instead.

## Licence

MIT © Jorge Carrera Díez

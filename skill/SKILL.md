---
name: dom2figma
description: Capture a live web page into editable Figma layers. Use when the user wants to take an existing website, page or route into Figma, mirror a site's current design in a Figma file, or build a design-system reference from production code.
---

# dom2figma

Take a URL, produce editable Figma layers. Runs headless Chrome locally, so there is
no per-import quota and no third-party render service.

## When to use

- "Take my site into Figma", "mirror the current design in Figma", "I want the real
  state of the app in a Figma file"
- Building a before/after for a redesign, where the "before" must be accurate
- Capturing several routes, viewports or themes in one pass

**Do not** use it to produce a design system. The output has no auto-layout, no
component instances and no variable bindings — a rendered page does not contain that
intent. Say so plainly, and offer to rebuild the key screens with real components
afterwards.

## Steps

1. **Capture.** One command per route × viewport × theme:

   ```bash
   npx dom2figma <url> --out out --name "<label>" --page "<figma page>" \
     --width 1440 --theme light --at <x>,<y>
   ```

   Repeat with `--width 390` for mobile and `--theme dark` for the dark variant.
   Lay frames out on a grid: give each route its own `x` column (page widths plus a
   gap), and put each theme in its own `y` band well below the tallest page.

2. **Suppress overlays first.** Cookie banners and onboarding modals will otherwise
   appear in every capture. Find the key the site persists consent under and pass it:

   ```bash
   --local-storage <key>=<value>
   ```

   Grep the codebase for `localStorage.setItem` near the banner component to find it.
   Verify by checking the captured JSON for the banner's text.

3. **Build in Figma.** Import `figma-plugin/manifest.json` once
   (*Plugins → Development → Import plugin from manifest…*), then paste each
   `<slug>.figma.json` and press Build.

4. **Verify, do not assume.** For each capture compare the node count in the JSON
   against the boxes+texts the plugin reports. A page that comes back with far fewer
   nodes than the DOM has is a bug in the capture, not a simple page — check for
   overlays, lazy content that needs a longer `--settle`, or auth walls.

## Batching

For many routes, drive the library rather than the CLI: `capture()` returns plain
JSON, so you can capture everything first (fast, parallel-safe) and build afterwards.
Keep a resumable list of what has been built — a long run will be interrupted.

## Gotchas

- **Node 22+** is required (global `WebSocket`).
- Pages behind auth need a Chrome that already has the session: start one with
  `--remote-debugging-port` and pass `--endpoint`.
- `--settle` defaults to 9s. Data-heavy pages may need more; the capture scrolls to
  the bottom and back to trigger lazy loading.
- Images load into Figma **by URL**, so they must be publicly reachable.

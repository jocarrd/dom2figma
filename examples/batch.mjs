/**
 * Capture many routes, viewports and themes in one run, then write one payload per
 * capture. Resumable: existing outputs are skipped.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { capture, launchChrome, toPayload } from '../src/index.mjs'

const ROUTES = ['https://example.com', 'https://example.com/about']
const VARIANTS = [
  { key: 'desktop', width: 1440, theme: 'light', label: 'desktop light', band: 0 },
  { key: 'mobile', width: 390, theme: 'light', label: 'mobile light', band: 0, dx: 1600 },
  { key: 'dark', width: 1440, theme: 'dark', label: 'desktop dark', band: 70000 }
]
const OUT = 'out'
const COLUMN = 3400

mkdirSync(OUT, { recursive: true })
const chrome = await launchChrome()

try {
  for (const [i, url] of ROUTES.entries()) {
    for (const v of VARIANTS) {
      const slug = `${String(i + 1).padStart(2, '0')}-${new URL(url).pathname.replace(/\W+/g, '-') || 'home'}.${v.key}`
      const out = join(OUT, `${slug}.figma.json`)
      if (existsSync(out)) continue

      const layout = await capture(url, {
        endpoint: chrome.endpoint,
        width: v.width,
        theme: v.theme,
        localStorage: { 'cookie-consent': 'all' }
      })
      const payload = toPayload(layout, {
        name: `${String(i + 1).padStart(2, '0')} · ${new URL(url).pathname} — ${v.label}`,
        page: 'Screens',
        x: i * COLUMN + (v.dx ?? 0),
        y: v.band
      })
      writeFileSync(out, JSON.stringify(payload))
      console.log(`${layout.n} nodes -> ${out}`)
    }
  }
} finally {
  chrome.stop()
}

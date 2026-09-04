#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { capture, launchChrome } from './capture.mjs'
import { toFigmaScript, toPayload } from './emit.mjs'

const USAGE = `
dom2figma — turn a live web page into editable Figma layers

  npx dom2figma <url> [options]

Options
  --out <dir>          output directory (default: ./out)
  --name <name>        frame name in Figma (default: the URL)
  --page <name>        Figma page to build on (default: dom2figma)
  --width <px>         viewport width; below 500 enables mobile emulation (default: 1440)
  --theme <light|dark> emulated prefers-color-scheme (default: light)
  --at <x,y>           where to place the frame on the canvas (default: 0,0)
  --endpoint <url>     use a Chrome already listening on a debugging port
  --settle <ms>        wait after load before extracting (default: 9000)
  --local-storage <k=v>  set before any page script runs; repeatable.
                         Handy for cookie banners: --local-storage consent=all
  --json-only          write the layout JSON and skip the Figma script

It writes three files in <dir>:
  <slug>.json         the captured layout, if you want to post-process it
  <slug>.figma.json   payload for the bundled plugin in figma-plugin/
  <slug>.figma.js     standalone script for any console-style Figma plugin
`

function parseArgs (argv) {
  const o = { out: 'out', width: 1440, theme: 'light', page: 'dom2figma', at: [0, 0], settle: 9000, localStorage: {} }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--out': o.out = next(); break
      case '--name': o.name = next(); break
      case '--page': o.page = next(); break
      case '--width': o.width = Number(next()); break
      case '--theme': o.theme = next(); break
      case '--endpoint': o.endpoint = next(); break
      case '--settle': o.settle = Number(next()); break
      case '--at': o.at = next().split(',').map(Number); break
      case '--json-only': o.jsonOnly = true; break
      case '--local-storage': { const kv = next(); const j = kv.indexOf('='); o.localStorage[kv.slice(0, j)] = kv.slice(j + 1); break }
      case '-h': case '--help': o.help = true; break
      default: rest.push(a)
    }
  }
  o.url = rest[0]
  return o
}

const slugify = (url) => {
  try {
    const u = new URL(url)
    const p = (u.hostname + u.pathname).replace(/\/$/, '')
    return p.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'page'
  } catch { return 'page' }
}

const opts = parseArgs(process.argv.slice(2))
if (opts.help || !opts.url) {
  console.log(USAGE)
  process.exit(opts.url ? 0 : 1)
}

let stopChrome = null
if (!opts.endpoint) {
  const chrome = await launchChrome()
  opts.endpoint = chrome.endpoint
  stopChrome = chrome.stop
}

try {
  const layout = await capture(opts.url, {
    endpoint: opts.endpoint,
    width: opts.width,
    theme: opts.theme,
    settleMs: opts.settle,
    localStorage: opts.localStorage
  })

  const slug = slugify(opts.url) + (opts.width < 500 ? '-mobile' : '') + (opts.theme === 'dark' ? '-dark' : '')
  mkdirSync(opts.out, { recursive: true })
  const jsonPath = join(opts.out, `${slug}.json`)
  writeFileSync(jsonPath, JSON.stringify(layout))
  console.log(`${layout.n} nodes  ${layout.w}x${layout.h}  ->  ${jsonPath}`)

  if (!opts.jsonOnly) {
    const shaped = { name: opts.name ?? opts.url, page: opts.page, x: opts.at[0], y: opts.at[1] }

    const payloadPath = join(opts.out, `${slug}.figma.json`)
    writeFileSync(payloadPath, JSON.stringify(toPayload(layout, shaped)))
    console.log(`Plugin payload -> ${payloadPath}`)

    const jsPath = join(opts.out, `${slug}.figma.js`)
    writeFileSync(jsPath, toFigmaScript(layout, shaped))
    console.log(`Standalone script -> ${jsPath}`)
  }
} finally {
  if (stopChrome) stopChrome()
}

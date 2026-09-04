import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { Tab, waitForEndpoint } from './cdp.mjs'

const EXTRACT = readFileSync(new URL('./extract.browser.js', import.meta.url), 'utf8')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean)

/**
 * Start a headless Chrome we own. Returns { endpoint, stop }.
 * If you already have a Chrome listening on a debugging port, skip this and
 * pass its endpoint to capture() instead.
 */
export async function launchChrome ({ port = 9333, userDataDir = '/tmp/dom2figma-profile' } = {}) {
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'
  ]
  let child, lastErr
  for (const bin of CHROME_CANDIDATES) {
    try {
      child = spawn(bin, args, { stdio: 'ignore', detached: true })
      child.unref()
      break
    } catch (e) { lastErr = e }
  }
  if (!child) throw new Error(`Could not start Chrome. Set CHROME_PATH. ${lastErr ?? ''}`)
  const endpoint = `http://127.0.0.1:${port}`
  await waitForEndpoint(endpoint)
  return { endpoint, stop: () => { try { process.kill(-child.pid) } catch { /* gone */ } } }
}

/**
 * Load a URL and return its layout tree.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.endpoint]   CDP endpoint (default http://127.0.0.1:9333)
 * @param {number} [opts.width]      viewport width; <500 turns on mobile emulation
 * @param {'light'|'dark'} [opts.theme]
 * @param {number} [opts.settleMs]   how long to let the page settle after load
 * @param {Record<string,string>} [opts.localStorage]
 *        Values written before any page script runs. Use it to pre-accept a
 *        cookie banner, which would otherwise cover every capture.
 */
export async function capture (url, opts = {}) {
  const {
    endpoint = 'http://127.0.0.1:9333',
    width = 1440, theme = 'light', settleMs = 9000, localStorage: ls = {}
  } = opts

  const tab = await Tab.open(endpoint)
  try {
    await tab.send('Page.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', {
      width, height: 1200, deviceScaleFactor: 1, mobile: width < 500
    })
    await tab.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: theme }]
    })
    if (Object.keys(ls).length) {
      const src = Object.entries(ls)
        .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)})`)
        .join(';')
      await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{${src}}catch(e){}` })
    }

    await tab.send('Page.navigate', { url })
    await sleep(settleMs)
    // Scroll to the bottom and back to trigger lazy-loaded content.
    await tab.evaluate('window.scrollTo(0, document.body.scrollHeight); 1')
    await sleep(3000)
    await tab.evaluate('window.scrollTo(0, 0); 1')
    await sleep(1500)

    const json = await tab.evaluate(EXTRACT)
    const layout = JSON.parse(json)
    layout.url = url
    layout.viewport = { width, theme }
    return layout
  } finally {
    await tab.close()
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

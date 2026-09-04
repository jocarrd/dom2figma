/**
 * The smallest Chrome DevTools Protocol client that does the job: HTTP for
 * target discovery, one WebSocket per tab. Node 22+ ships a global WebSocket,
 * so this file has no dependencies.
 */
const DEFAULT_ENDPOINT = 'http://127.0.0.1:9222'

async function httpJson (endpoint, path, method = 'GET') {
  const res = await fetch(endpoint + path, { method })
  if (!res.ok) throw new Error(`CDP ${method} ${path} -> ${res.status}`)
  return res.json()
}

export async function version (endpoint = DEFAULT_ENDPOINT) {
  return httpJson(endpoint, '/json/version')
}

export async function waitForEndpoint (endpoint = DEFAULT_ENDPOINT, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try { return await version(endpoint) } catch {
      if (Date.now() > deadline) throw new Error(`No CDP endpoint at ${endpoint}`)
      await new Promise((r) => setTimeout(r, 250))
    }
  }
}

/**
 * List page targets. Useful when a browser has several tabs open: picking the
 * first one is a trap, since anything the user opens later can shadow it.
 */
export async function listTabs (endpoint = DEFAULT_ENDPOINT) {
  const targets = await httpJson(endpoint, '/json')
  return targets.filter((t) => t.type === 'page')
}

export class Tab {
  #ws; #id = 0; #pending = new Map()

  constructor (ws) {
    this.#ws = ws
    ws.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      const p = this.#pending.get(msg.id)
      if (!p) return
      this.#pending.delete(msg.id)
      msg.error ? p.reject(new Error(`${p.method}: ${msg.error.message}`)) : p.resolve(msg.result ?? {})
    })
  }

  /** Attach to an existing tab whose URL matches, instead of opening a new one. */
  static async attach (endpoint = DEFAULT_ENDPOINT, match) {
    const test = match instanceof RegExp ? (u) => match.test(u) : (u) => u.includes(match)
    const target = (await listTabs(endpoint)).find((t) => test(t.url))
    if (!target) throw new Error(`No open tab matching ${match}`)
    return Tab.#connect(endpoint, target)
  }

  static async open (endpoint = DEFAULT_ENDPOINT, url = 'about:blank') {
    const target = await httpJson(endpoint, `/json/new?${encodeURIComponent(url)}`, 'PUT')
    return Tab.#connect(endpoint, target)
  }

  static async #connect (endpoint, target) {
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true })
    })
    const tab = new Tab(ws)
    tab.targetId = target.id
    tab.endpoint = endpoint
    return tab
  }

  send (method, params = {}) {
    const id = ++this.#id
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method })
      this.#ws.send(JSON.stringify({ id, method, params }))
    })
  }

  /** Evaluate an expression and return its value. Throws on page exceptions. */
  async evaluate (expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    })
    if (r.exceptionDetails) {
      const d = r.exceptionDetails
      throw new Error(d.exception?.description || d.text || 'evaluate failed')
    }
    return r.result?.value
  }

  async close () {
    try { this.#ws.close() } catch { /* already gone */ }
    try { await fetch(`${this.endpoint}/json/close/${this.targetId}`) } catch { /* already gone */ }
  }
}

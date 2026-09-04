/**
 * Runs inside the page. Walks the DOM and returns a flat, pre-ordered list of
 * every visible box and text run, with absolute page coordinates and resolved
 * styles. Pre-order means parents come before children, so painting the list in
 * order reproduces the stacking of the original document.
 *
 * Returns a JSON string (CDP returnByValue keeps it cheap).
 */
(() => {
  const R = (n) => Math.round(n * 10) / 10
  const px = (v) => { const f = parseFloat(v); return isNaN(f) ? 0 : f }

  // Modern CSS colours (Tailwind v4 emits `color(srgb ...)` and `oklab(...)`)
  // are not worth parsing by hand. Painting one pixel and reading it back lets
  // the browser do the conversion for every syntax it supports.
  const cv = document.createElement('canvas')
  cv.width = 1; cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const memo = new Map()
  function col(s) {
    if (!s || s === 'none' || s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null
    if (memo.has(s)) return memo.get(s)
    let v = null
    try {
      cx.clearRect(0, 0, 1, 1)
      cx.fillStyle = '#000000'
      cx.fillStyle = s
      cx.fillRect(0, 0, 1, 1)
      const d = cx.getImageData(0, 0, 1, 1).data
      if (d[3] !== 0) {
        v = [Math.round(d[0] / 255 * 1000) / 1000, Math.round(d[1] / 255 * 1000) / 1000,
             Math.round(d[2] / 255 * 1000) / 1000, Math.round(d[3] / 255 * 100) / 100]
      }
    } catch { v = null }
    memo.set(s, v)
    return v
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'TITLE', 'HEAD', 'BR', 'TEMPLATE'])
  const root = document.documentElement
  const W = root.scrollWidth, H = root.scrollHeight
  const out = []
  let id = 0

  function walk(el, depth) {
    if (depth > 60) return
    if (SKIP.has(el.tagName)) return

    const cs = getComputedStyle(el)
    if (cs.display === 'none') return

    const r = el.getBoundingClientRect()
    const x = r.left + window.scrollX, y = r.top + window.scrollY

    // Out of range or invisible: do not paint it, but keep walking its children.
    // A zero-sized wrapper is common and its subtree is usually the real content.
    const invisible = cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0
    const degenerate = r.width < 1 || r.height < 1
    const outside = y > H + 50 || x > W + 50 || r.bottom < -50
    if (invisible || degenerate || outside) {
      for (const c of el.children) walk(c, depth + 1)
      return
    }

    const bg = col(cs.backgroundColor)
    const bw = px(cs.borderTopWidth)
    const bc = bw > 0 ? col(cs.borderTopColor) : null
    const rad = [px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius),
                 px(cs.borderBottomRightRadius), px(cs.borderBottomLeftRadius)]
    const hasRad = rad.some((v) => v > 0)
    const img = el.tagName === 'IMG'
      ? (el.currentSrc || el.src)
      : (cs.backgroundImage && cs.backgroundImage.startsWith('url(') ? cs.backgroundImage.slice(5, -2) : null)
    const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 120) : null

    // Only direct text children count, so text is attributed to the element that
    // actually renders it. The element box is NOT the text box: a padded link
    // centres its text, so we measure the glyph run itself with a Range.
    let txt = ''
    let tb = null
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue
      txt += n.nodeValue
      try {
        const rg = document.createRange()
        rg.selectNodeContents(n)
        const rr = rg.getBoundingClientRect()
        if (rr.width > 0 && rr.height > 0) {
          tb = tb
            ? { left: Math.min(tb.left, rr.left), top: Math.min(tb.top, rr.top),
                right: Math.max(tb.right, rr.right), bottom: Math.max(tb.bottom, rr.bottom) }
            : { left: rr.left, top: rr.top, right: rr.right, bottom: rr.bottom }
        }
      } catch { /* detached node */ }
    }
    txt = txt.replace(/\s+/g, ' ').trim()

    if (bg || bc || img || txt || shadow) {
      const o = { i: id++, t: el.tagName, x: R(x), y: R(y), w: R(r.width), h: R(r.height) }
      if (bg) o.bg = bg
      if (bc) { o.bc = bc; o.bw = R(bw) }
      if (hasRad) o.r = rad.map(R)
      if (img) o.img = img.slice(0, 500)
      if (shadow) o.sh = shadow
      if (txt) {
        o.s = txt.slice(0, 400)
        if (tb) {
          o.tx = R(tb.left + window.scrollX); o.ty = R(tb.top + window.scrollY)
          o.tw = R(tb.right - tb.left); o.th = R(tb.bottom - tb.top)
        }
        o.fs = R(px(cs.fontSize))
        o.lh = cs.lineHeight === 'normal' ? R(px(cs.fontSize) * 1.4) : R(px(cs.lineHeight))
        o.fw = cs.fontWeight
        o.ff = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim()
        o.fc = col(cs.color)
        o.ta = cs.textAlign
        if (cs.textDecorationLine && cs.textDecorationLine.includes('underline')) o.ul = 1
        const tt = cs.textTransform
        if (tt === 'uppercase') o.s = o.s.toUpperCase()
        else if (tt === 'lowercase') o.s = o.s.toLowerCase()
        else if (tt === 'capitalize') o.s = o.s.replace(/\b\w/g, (ch) => ch.toUpperCase())
        const ls = px(cs.letterSpacing)
        if (Math.abs(ls) > 0.05) o.ls = R(ls)
      }
      out.push(o)
    }
    for (const c of el.children) walk(c, depth + 1)
  }

  walk(document.body, 0)
  return JSON.stringify({ w: R(W), h: R(H), n: out.length, nodes: out })
})()

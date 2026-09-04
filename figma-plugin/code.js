// GENERATED FILE — do not edit. Run: npm run build:plugin
figma.showUI(__html__, { width: 460, height: 460, themeColors: true })

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'build') return
  try {
    const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload
    const D = { w: payload.w, h: payload.h, bg: payload.bg, fonts: payload.fonts, nodes: payload.nodes }
    const NAME = msg.name || payload.name || 'Captured page'
    const PAGE = msg.page || payload.page || 'dom2figma'
    const OX = Number(msg.x !== undefined ? msg.x : (payload.x || 0))
    const OY = Number(msg.y !== undefined ? msg.y : (payload.y || 0))

    let target = figma.root.children.find(p => p.name === PAGE)
    if (!target) { target = figma.createPage(); target.name = PAGE }
    await figma.setCurrentPageAsync(target)

    const F = []
    for (const f of D.fonts) {
      const fn = { family: f[0], style: f[1] }
      try { await figma.loadFontAsync(fn); F.push(fn) }
      catch (e) {
        const alt = { family: 'Inter', style: 'Regular' }
        await figma.loadFontAsync(alt); F.push(alt)
      }
    }

    const previous = target.children.find(c => c.name === NAME)
    if (previous) previous.remove()

    const root = figma.createFrame()
    root.name = NAME
    target.appendChild(root)
    root.x = OX; root.y = OY
    root.resize(D.w, D.h)
    root.clipsContent = true
    root.fills = [{ type: 'SOLID', color: { r: D.bg[0], g: D.bg[1], b: D.bg[2] } }]

    const fill = a => [{ type: 'SOLID', color: { r: a[0], g: a[1], b: a[2] }, opacity: a[3] }]

    let boxes = 0, texts = 0, images = 0, imageErrors = 0
    for (const n of D.nodes) {
      const w = Math.max(1, n.w), h = Math.max(1, n.h)
      if (n.bg || n.bc || n.img || n.e) {
        const r = figma.createRectangle()
        root.appendChild(r)
        r.x = n.x; r.y = n.y
        r.resize(w, h)
        r.name = n.img ? 'image' : 'box'
        r.fills = n.bg ? fill(n.bg) : []
        if (n.bc) { r.strokes = fill(n.bc); r.strokeWeight = Math.max(0.5, n.bw); r.strokeAlign = 'INSIDE' }
        if (n.r) {
          r.topLeftRadius = n.r[0]; r.topRightRadius = n.r[1]
          r.bottomRightRadius = n.r[2]; r.bottomLeftRadius = n.r[3]
        }
        if (n.e) {
          r.effects = [{
            type: 'DROP_SHADOW', color: { r: n.e[0], g: n.e[1], b: n.e[2], a: n.e[3] },
            offset: { x: n.e[4], y: n.e[5] }, radius: n.e[6], spread: n.e[7],
            visible: true, blendMode: 'NORMAL'
          }]
        }
        if (n.img) {
          try {
            const im = await figma.createImageAsync(n.img)
            r.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: im.hash }]
            images++
          } catch (e) { imageErrors++ }
        }
        boxes++
      }
      if (n.s) {
        const t = figma.createText()
        root.appendChild(t)
        t.fontName = F[n.f]
        t.fontSize = Math.max(1, n.fs)
        t.lineHeight = { unit: 'PIXELS', value: Math.max(1, n.lh) }
        t.characters = n.s
        if (n.fc) t.fills = fill(n.fc)
        if (n.ul) t.textDecoration = 'UNDERLINE'
        if (n.ls) t.letterSpacing = { unit: 'PIXELS', value: n.ls }
        if (n.ta) t.textAlignHorizontal = n.ta
        if (n.one) { t.textAutoResize = 'WIDTH_AND_HEIGHT' }
        else { t.textAutoResize = 'HEIGHT'; t.resize(Math.max(1, n.tw) + 2, t.height) }
        t.x = n.tx; t.y = n.ty
        t.name = n.s.slice(0, 40)
        texts++
      }
    }

    const summary = { frame: root.id, boxes, texts, images, imageErrors }
    if (typeof print === 'function') print(JSON.stringify(summary))
    summary

    figma.ui.postMessage({ type: 'done', summary })
    figma.viewport.scrollAndZoomIntoView([root])
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) })
  }
}

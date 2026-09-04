/**
 * Generates figma-plugin/code.js from the single source of truth in src/emit.mjs,
 * so the plugin and the standalone script can never drift apart.
 */
import { writeFileSync } from 'node:fs'
import { BUILDER_BODY } from '../src/emit.mjs'

const code = `// GENERATED FILE — do not edit. Run: npm run build:plugin
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
${BUILDER_BODY.split('\n').map((l) => (l ? '    ' + l : l)).join('\n')}
    figma.ui.postMessage({ type: 'done', summary })
    figma.viewport.scrollAndZoomIntoView([root])
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) })
  }
}
`
writeFileSync(new URL('../figma-plugin/code.js', import.meta.url), code)
console.log('figma-plugin/code.js written')

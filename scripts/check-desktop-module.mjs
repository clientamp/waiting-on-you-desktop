import assert from 'node:assert/strict'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
register('./plugin-loader.mjs', pathToFileURL(join(root, 'plugin-loader.mjs')))

const pluginUrl = pathToFileURL(join(root, '..', 'desktop', 'plugin.js')).href
const plugin = (await import(pluginUrl)).default

const contributions = []
const ctx = {
  register: item => {
    contributions.push(item)
    return () => {}
  },
  registerMany: items => {
    contributions.push(...items)
    return () => {}
  },
  onDispose() {},
  addEventListener() {},
  storage: { get: (_k, fb) => fb, set() {}, remove() {} },
  os: { writeClipboard: async () => true, openExternal: async () => true },
}

assert.equal(plugin.id, 'waiting-on-you-desktop')
assert.equal(typeof plugin.register, 'function')
plugin.register(ctx)

const areas = new Set(contributions.map(c => c.area))
assert.ok(areas.has('routes'), 'routes')
assert.ok(areas.has('sidebar.nav'), 'sidebar.nav')
assert.ok(areas.has('panes'), 'panes')
assert.ok(areas.has('palette'), 'palette')
assert.ok(areas.has('composer.actions'), 'composer.actions')
assert.ok(
  contributions.some(c => c.area === 'statusBar.right'),
  'statusBar.right',
)
assert.ok(
  contributions.some(
    c => c.area === 'palette' && c.data?.label?.includes('Show or hide'),
  ),
  'palette show/hide toggle',
)

console.log(
  'PASS compiled Desktop module: id, register, routes, sidebar.nav, panes, palette, composer.actions, statusBar.right',
)

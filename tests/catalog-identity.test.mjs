import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('desktop catalog id matches plugin.yaml and dashboard manifest', () => {
  const yaml = readFileSync('plugin.yaml', 'utf8')
  const manifest = JSON.parse(readFileSync('dashboard/manifest.json', 'utf8'))
  const shortcuts = readFileSync('src/ui/shortcuts.ts', 'utf8')
  const m = yaml.match(/^name:\s*(.+)$/m)
  assert.ok(m, 'plugin.yaml name')
  const catalogId = m[1].trim()
  assert.equal(catalogId, 'waiting-on-you-desktop')
  assert.equal(manifest.name, catalogId)
  assert.match(shortcuts, /export const PLUGIN_ID = 'waiting-on-you-desktop'/)
})

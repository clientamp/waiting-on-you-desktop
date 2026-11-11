import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadShortcuts() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-shortcuts-'))
  const outfile = join(dir, 'shortcuts.mjs')
  await build({
    entryPoints: ['src/ui/shortcuts.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
  })
  const url = new URL(`file://${outfile}`)
  const mod = await import(url.href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

test('comboToKeyCaps formats mod+alt+p Mac-style', async () => {
  const { comboToKeyCaps } = await loadShortcuts()
  assert.deepEqual(comboToKeyCaps('mod+alt+p'), ['⌘', '⌥', 'P'])
  assert.deepEqual(comboToKeyCaps('mod+z'), ['⌘', 'Z'])
})

test('SETTINGS_SHORTCUT_ROWS ids are unique', async () => {
  const { SETTINGS_SHORTCUT_ROWS } = await loadShortcuts()
  const ids = SETTINGS_SHORTCUT_ROWS.map(r => r.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('KEYBIND_DEFINITIONS keybindIds are unique', async () => {
  const { KEYBIND_DEFINITIONS } = await loadShortcuts()
  const ids = KEYBIND_DEFINITIONS.map(d => d.keybindId)
  assert.equal(new Set(ids).size, ids.length)
  const showAll = KEYBIND_DEFINITIONS.find(d => d.keybindId === 'waiting-on-you-desktop.toggle-answer-bars')
  assert.deepEqual(showAll?.defaults, ['mod+alt+a'])
})

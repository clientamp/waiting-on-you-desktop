import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadPaneToggle() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-pane-toggle-'))
  const outfile = join(dir, 'paneToggle.mjs')
  await build({
    entryPoints: ['src/ui/paneToggle.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
  })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

test('decidePaneToggle: registered and visible hides', async () => {
  const { decidePaneToggle } = await loadPaneToggle()
  assert.equal(
    decidePaneToggle({ registered: true, visible: true, hasActiveSession: true }),
    'hide',
  )
  assert.equal(
    decidePaneToggle({ registered: true, visible: true, hasActiveSession: false }),
    'hide',
  )
})

test('decidePaneToggle: registered but not visible reveals when session active', async () => {
  const { decidePaneToggle } = await loadPaneToggle()
  assert.equal(
    decidePaneToggle({ registered: true, visible: false, hasActiveSession: true }),
    'reveal',
  )
})

test('decidePaneToggle: registered but not visible navigates without session', async () => {
  const { decidePaneToggle } = await loadPaneToggle()
  assert.equal(
    decidePaneToggle({ registered: true, visible: false, hasActiveSession: false }),
    'navigate',
  )
})

test('decidePaneToggle: unregistered shows when session active', async () => {
  const { decidePaneToggle } = await loadPaneToggle()
  assert.equal(
    decidePaneToggle({ registered: false, visible: false, hasActiveSession: true }),
    'show',
  )
})

test('decidePaneToggle: unregistered navigates without session', async () => {
  const { decidePaneToggle } = await loadPaneToggle()
  assert.equal(
    decidePaneToggle({ registered: false, visible: false, hasActiveSession: false }),
    'navigate',
  )
})

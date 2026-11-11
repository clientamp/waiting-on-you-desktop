import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-panel-load-'))
  const outfile = join(dir, 'panelLoad.mjs')
  await build({
    entryPoints: ['src/ui/panelLoad.ts'],
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

const { loadRetryDelayMs, combinePaneVisible, LOAD_RETRY_BACKOFF_MS } =
  await load()

test('loadRetryDelayMs follows backoff schedule then holds at 30s', () => {
  assert.equal(loadRetryDelayMs(0), 2000)
  assert.equal(loadRetryDelayMs(1), 5000)
  assert.equal(loadRetryDelayMs(2), 10000)
  assert.equal(loadRetryDelayMs(3), 30000)
  assert.equal(loadRetryDelayMs(99), 30000)
  assert.equal(loadRetryDelayMs(-1), 2000)
  assert.deepEqual(LOAD_RETRY_BACKOFF_MS, [2000, 5000, 10000, 30000])
})

test('combinePaneVisible: host visible always wins', () => {
  assert.equal(combinePaneVisible(true, false, false), true)
  assert.equal(combinePaneVisible(true, null, false), true)
})

test('combinePaneVisible: DOM path needs intersection and document visible', () => {
  assert.equal(combinePaneVisible(false, true, true), true)
  assert.equal(combinePaneVisible(false, true, false), false)
  assert.equal(combinePaneVisible(false, false, true), false)
  assert.equal(combinePaneVisible(false, null, true), false)
})

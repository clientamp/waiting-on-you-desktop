import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadSessionApi() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-gone-'))
  const outfile = join(dir, 'sessionApi.mjs')
  await build({
    entryPoints: ['src/ui/sessionApi.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    external: ['@hermes/plugin-sdk', 'react'],
  })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

test('model-route 409 preserves the short notice for the panel', async () => {
  const { restErrorFields } = await loadSessionApi()
  const notice = 'This model request is already running. Try again shortly.'
  assert.deepEqual(restErrorFields(new Error(`409: ${JSON.stringify({ error: notice })}`)), {
    status: 409, error: notice,
  })
})

test('isAlreadyGone: group/task 404 from the desktop bridge message', async () => {
  const { isAlreadyGone } = await loadSessionApi()
  assert.equal(isAlreadyGone(new Error('404: {"error":"group not found"}')), true)
  assert.equal(isAlreadyGone(new Error('404: {"error":"task not found"}')), true)
  assert.equal(isAlreadyGone({ status: 404, body: { error: 'group not found' } }), true)
})

test('isAlreadyGone: other errors are not treated as already cleared', async () => {
  const { isAlreadyGone } = await loadSessionApi()
  assert.equal(isAlreadyGone(new Error('404: {"detail":"Plugin not found"}')), false)
  assert.equal(isAlreadyGone(new Error('400: {"error":"invalid status"}')), false)
  assert.equal(isAlreadyGone(new Error('500: boom')), false)
})

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadGate() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-backend-gate-'))
  const outfile = join(dir, 'backendGate.mjs')
  await build({
    entryPoints: ['src/ui/backendGate.ts'],
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

const consent = new Error('404: {"detail": "Plugin not found"}')

test('consent-gate 404 is a miss; a missing task is not', async () => {
  const { isConsentMiss } = await loadGate()
  assert.equal(isConsentMiss(consent), true)
  assert.equal(isConsentMiss({ status: 404, body: { detail: 'Plugin not found' } }), true)
  assert.equal(isConsentMiss({ status: 404, body: { error: 'task not found' } }), false)
  assert.equal(isConsentMiss(new Error('network down')), false)
})

test('a consent miss hides the plugin and does not flip it back on a later miss', async () => {
  const { getBackendAvailable, noteConsentMiss, setBackendAvailable } = await loadGate()
  setBackendAvailable(true)
  assert.equal(noteConsentMiss(), true)
  assert.equal(getBackendAvailable(), false)
  assert.equal(noteConsentMiss(), false)
  setBackendAvailable(true)
})

test('probe hides only on the consent gate, and a stale probe cannot overwrite a newer one', async () => {
  const { getBackendAvailable, probeBackend, setBackendAvailable } = await loadGate()
  setBackendAvailable(true)

  let releaseFirst
  const first = new Promise((resolve, reject) => {
    releaseFirst = () => reject(consent)
  })
  const pending = probeBackend(() => first)
  const second = probeBackend(async () => ({ ok: true }))
  await second
  releaseFirst()
  await pending
  assert.equal(getBackendAvailable(), true)

  await probeBackend(async () => {
    throw consent
  })
  assert.equal(getBackendAvailable(), false)

  await probeBackend(async () => {
    throw new Error('gateway down')
  })
  assert.equal(getBackendAvailable(), false)
})

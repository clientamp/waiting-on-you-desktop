import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-snapshot-'))
  const outfile = join(dir, 'snapshot.mjs')
  await build({
    entryPoints: ['src/ui/projectSnapshot.ts'],
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

const m = await load()

test('a late answer from the previous project does not replace the current project', () => {
  const alpha = { project_id: '1', cards: ['Alpha decision'] }
  const beta = { project_id: '2', cards: ['Beta decision'] }
  const requestedAlpha = { scope: '1', seq: 1 }
  const currentBeta = { scope: '2', seq: 2 }

  assert.equal(m.acceptScopedPayload(requestedAlpha, currentBeta, alpha), null)
  assert.deepEqual(m.acceptScopedPayload({ scope: '2', seq: 2 }, currentBeta, beta), beta)
  // An older request for the same project must not win after a newer load started.
  assert.equal(m.acceptScopedPayload({ scope: '2', seq: 1 }, currentBeta, beta), null)
  // A response that names a different project than the one now selected is dropped.
  assert.equal(m.acceptScopedPayload(currentBeta, currentBeta, alpha), null)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('decision save merges acknowledged fields, preserves dirty edits and ignores stale responses', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wou-drafts-'))
  try {
    const outfile = join(dir, 'drafts.mjs')
    await build({ entryPoints: ['src/ui/decisionDrafts.ts'], outfile, bundle: true, platform: 'node', format: 'esm' })
    const { mergeDecisionDrafts } = await import(new URL(`file://${outfile}`).href)
    const before = { model: 'old', base_url: 'https://old', cloudflare_account_id: '' }
    const sent = { ...before, model: 'new', base_url: 'unsaved' }
    const current = { ...sent, model: 'newer' }
    const response = { model: 'new', base_url: 'https://old', cloudflare_account_id: 'server' }
    assert.deepEqual(mergeDecisionDrafts(current, sent, before, { model: 'new' }, response, 2, 2), { model: 'newer', base_url: 'unsaved', cloudflare_account_id: 'server' })
    assert.equal(mergeDecisionDrafts(current, sent, before, {}, response, 1, 2), current)
    assert.equal(mergeDecisionDrafts(sent, sent, before, { model: 'new' }, response, 2, 2).model, 'new')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

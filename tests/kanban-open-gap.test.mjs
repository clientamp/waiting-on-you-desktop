import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-kanban-open-'))
  const outfile = join(dir, 'kanbanOpen.mjs')
  await build({
    entryPoints: ['src/ui/kanbanOpen.ts'],
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

test('Kanban navigation helper preserves an ID without claiming exact-card navigation', async () => {
  // This helper is not rendered by CatchUpView. The view/docs contract
  // lives in kanban-docs.test.mjs; helper metadata is not UI coverage.
  const plan = (await load()).kanbanOpenPlan('t_example')
  assert.equal(plan.path, '/kanban')
  assert.equal(plan.label, 'Open Kanban')
  assert.equal(plan.cardId, 't_example')
  assert.equal(plan.path.includes('?'), false)

  for (const file of [
    'src/ui/TasksPanel.tsx',
    'src/ui/answers.ts',
    'src/ui/openChat.ts',
    'src/hermes/entry.tsx',
    'src/ui/kanbanOpen.ts',
  ]) {
    assert.doesNotMatch(read(file), /\/kanban\?/)
  }
})

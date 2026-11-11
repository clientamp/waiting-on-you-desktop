import assert from 'node:assert/strict'
import { build } from 'esbuild'
import test from 'node:test'

const result = await build({
  entryPoints: ['src/ui/undo.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', target: 'es2022',
})
const { narrowGroupUndo } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const tasks = [{ id: 1 }, { id: 2 }]
const entry = { scope: 'group', tasks, patches: tasks.map(task => ({ task, patch: { status: 'open' } })), kind: 'done', message: 'Done' }

test('all-stale group close produces no Undo entry', () => {
  assert.equal(typeof narrowGroupUndo, 'function')
  assert.equal(narrowGroupUndo(entry, []), null)
})

test('mixed stale group close offers Undo only for changed tasks', () => {
  const narrowed = narrowGroupUndo(entry, [2])
  assert.deepEqual(narrowed.tasks, [tasks[1]])
  assert.deepEqual(narrowed.patches, [entry.patches[1]])
  assert.equal(narrowGroupUndo(entry, undefined), entry)
})

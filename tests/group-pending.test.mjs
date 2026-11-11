import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadGroupPending() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-group-pending-'))
  const outfile = join(dir, 'groupPending.mjs')
  await build({
    entryPoints: ['src/ui/groupPending.ts'],
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

test('group pending clears after animation and response for the same token', async () => {
  const {
    startGroupOp,
    markGroupAnimDone,
    finishGroupResponse,
    groupPendingLabel,
  } = await loadGroupPending()
  let state = startGroupOp({}, 'chat-a', 'Done…', 1)
  assert.equal(groupPendingLabel(state, 'chat-a'), 'Done…')
  state = markGroupAnimDone(state, 'chat-a', 1)
  assert.equal(groupPendingLabel(state, 'chat-a'), 'Done…')
  state = finishGroupResponse(state, 'chat-a', 1)
  assert.equal(groupPendingLabel(state, 'chat-a'), undefined)
})

test('slow response after animation does not leave stuck pending', async () => {
  const {
    startGroupOp,
    markGroupAnimDone,
    finishGroupResponse,
    groupPendingLabel,
  } = await loadGroupPending()
  let state = startGroupOp({}, 'chat-b', 'Done…', 2)
  state = markGroupAnimDone(state, 'chat-b', 2)
  assert.equal(groupPendingLabel(state, 'chat-b'), 'Done…')
  state = finishGroupResponse(state, 'chat-b', 2, 'Chat archived')
  assert.equal(groupPendingLabel(state, 'chat-b'), undefined)
})

test('newer group operation is not cleared by stale timers', async () => {
  const {
    startGroupOp,
    markGroupAnimDone,
    finishGroupResponse,
    cancelGroupOp,
    groupPendingLabel,
  } = await loadGroupPending()
  let state = startGroupOp({}, 'chat-c', 'Done…', 1)
  state = startGroupOp(state, 'chat-c', 'Snoozed…', 2)
  state = markGroupAnimDone(state, 'chat-c', 1)
  assert.equal(groupPendingLabel(state, 'chat-c'), 'Snoozed…')
  state = finishGroupResponse(state, 'chat-c', 1)
  assert.equal(groupPendingLabel(state, 'chat-c'), 'Snoozed…')
  state = markGroupAnimDone(state, 'chat-c', 2)
  state = finishGroupResponse(state, 'chat-c', 2)
  assert.equal(groupPendingLabel(state, 'chat-c'), undefined)
  state = cancelGroupOp(state, 'chat-c', 99)
  assert.equal(groupPendingLabel(state, 'chat-c'), undefined)
})

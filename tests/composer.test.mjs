import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadModel() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-composer-'))
  const outfile = join(dir, 'model.mjs')
  await build({
    entryPoints: ['src/model.ts'],
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

const baseTask = (overrides = {}) => ({
  id: 1,
  chat_key: 'k',
  agent: 'A',
  chat_title: 'T',
  ask: 'ask',
  topic: 'topic',
  quadrant: 2,
  status: 'open',
  snooze_until: null,
  source_msg_id: null,
  created_at: 1,
  updated_at: 1,
  fingerprint: 'f',
  quadrant_locked: false,
  project: null,
  tags: [],
  ...overrides,
})

test('sessionQueryParams omits local and active-connection ids', async () => {
  const { sessionQueryParams } = await loadModel()
  assert.deepEqual(
    sessionQueryParams('s1', 'default', { connectionId: 'local', profile: 'default' }),
    { session_id: 's1', profile: 'default' },
  )
  assert.deepEqual(
    sessionQueryParams(
      's1',
      '',
      { connectionId: 'mac-mini-tail', profile: 'default' },
      'mac-mini-tail',
    ),
    { session_id: 's1', profile: 'default' },
  )
  assert.deepEqual(
    sessionQueryParams(
      's1',
      '',
      { connectionId: 'conn-9', profile: 'default' },
      'local-active',
    ),
    { session_id: 's1', profile: 'default', connection_id: 'conn-9' },
  )
})

test('sessionConnectionIdForApi', async () => {
  const { sessionConnectionIdForApi } = await loadModel()
  assert.equal(sessionConnectionIdForApi(null, 'x'), undefined)
  assert.equal(sessionConnectionIdForApi({ connectionId: 'local', profile: 'default' }, 'x'), undefined)
  assert.equal(
    sessionConnectionIdForApi({ connectionId: 'same', profile: 'default' }, 'same'),
    undefined,
  )
  assert.equal(
    sessionConnectionIdForApi({ connectionId: 'remote-1', profile: 'default' }, 'local-here'),
    'remote-1',
  )
})

test('remote session requests carry a plain id, not a prefixed chat key', async () => {
  const { sessionPostBody, sessionQueryParams } = await loadModel()
  const owner = { connectionId: 'remote-connection', profile: 'default' }
  const body = sessionPostBody('session-1', 'default', owner, 'hub', { quadrant: 2 })
  const params = sessionQueryParams('session-1', 'default', owner, 'hub')
  assert.equal(body.session_id, 'session-1')
  assert.equal(params.session_id, 'session-1')
  assert.equal(body.connection_id, 'remote-connection')
  assert.equal(params.connection_id, 'remote-connection')
  assert.equal(body.session_id.includes(':'), false)
})

test('sessionPostBody mirrors query connection rules', async () => {
  const { sessionPostBody } = await loadModel()
  const body = sessionPostBody('s1', 'bob', null, null, { quadrant: 3, ask: 'hi' })
  assert.equal(body.session_id, 's1')
  assert.equal(body.profile, 'bob')
  assert.equal(body.quadrant, 3)
  assert.equal(body.ask, 'hi')
  assert.equal(body.connection_id, undefined)
  const remote = sessionPostBody(
    's1',
    'default',
    { connectionId: 'office', profile: 'default' },
    'desktop',
    { quadrant: 2 },
  )
  assert.equal(remote.connection_id, 'office')
})

test('groupCloseTaskIds lists snapshot members', async () => {
  const { groupCloseTaskIds } = await loadModel()
  assert.deepEqual(
    groupCloseTaskIds([baseTask({ id: 3 }), baseTask({ id: 7 })]),
    [3, 7],
  )
})

test('composerPatchTarget chooses task vs group', async () => {
  const { composerPatchTarget } = await loadModel()
  const one = [baseTask({ id: 42 })]
  assert.deepEqual(composerPatchTarget(one, 'k'), { kind: 'task', taskId: 42 })
  const two = [baseTask({ id: 1 }), baseTask({ id: 2 })]
  assert.deepEqual(composerPatchTarget(two, 'chat-key'), { kind: 'group', chatKey: 'chat-key' })
})

test('sessionCurrentQuadrant', async () => {
  const { sessionCurrentQuadrant } = await loadModel()
  assert.equal(sessionCurrentQuadrant([], { quadrant: 3 }), 3)
  assert.equal(sessionCurrentQuadrant([baseTask({ quadrant: 4 })], null), 4)
  assert.equal(sessionCurrentQuadrant([], null), 2)
})

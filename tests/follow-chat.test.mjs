import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-follow-'))
  const outfile = join(dir, 'followChat.mjs')
  await build({
    entryPoints: ['src/ui/followChat.ts'],
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

const {
  taskMatchesFocusedSession,
  taskMatchesFocusedSessionForPresence,
  computeFollowUnhideActions,
  hostProvidesOwnerContext,
} = await load()

const mainTask = {
  chat_key: 'sess-abc',
  chat_target: { session_id: 'sess-abc', profile: null, connection: null },
  status: 'open',
}

const profileTask = {
  chat_key: 'juno:sess-abc',
  chat_target: {
    session_id: 'sess-abc',
    profile: 'juno',
    connection: 'conn-9',
    connection_aliases: ['conn-9', 'conn-alt'],
  },
  status: 'open',
}

test('main chat matches session id', () => {
  assert.equal(
    taskMatchesFocusedSession(mainTask, { sessionId: 'sess-abc' }),
    true,
  )
  assert.equal(
    taskMatchesFocusedSession(mainTask, { sessionId: 'other' }),
    false,
  )
})

test('presence ignores main chat when sidebar focus is profile-scoped', () => {
  const sessionLocal = {
    chat_key: 'local-' + 'e'.repeat(64),
    chat_target: null,
    status: 'open',
  }
  const sel = { sessionId: sessionLocal.chat_key, profile: 'work', owner: null }
  assert.equal(taskMatchesFocusedSession(sessionLocal, sel), true)
  assert.equal(taskMatchesFocusedSessionForPresence(sessionLocal, sel), false)
})

test('profile chat with owner matches session and connection', () => {
  const sel = {
    sessionId: 'sess-abc',
    profile: 'juno',
    owner: { connectionId: 'conn-9', profile: 'juno' },
  }
  assert.equal(taskMatchesFocusedSession(profileTask, sel), true)
  assert.equal(
    taskMatchesFocusedSession(profileTask, {
      ...sel,
      owner: { connectionId: 'other', profile: 'juno' },
    }),
    false,
  )
})

test('profile chat without owner info matches on session id only', () => {
  assert.equal(
    taskMatchesFocusedSession(profileTask, { sessionId: 'sess-abc' }),
    true,
  )
  assert.equal(hostProvidesOwnerContext({ sessionId: 'sess-abc' }), false)
})

test('no match for different session or non-chat source', () => {
  assert.equal(
    taskMatchesFocusedSession(
      { chat_key: 'mailhist:x', chat_target: null, status: 'open' },
      { sessionId: 'x' },
    ),
    false,
  )
  assert.equal(
    taskMatchesFocusedSession(mainTask, { sessionId: 'sess-other' }),
    false,
  )
})

test('done task is ignored', () => {
  assert.equal(
    taskMatchesFocusedSession({ ...mainTask, status: 'done' }, { sessionId: 'sess-abc' }),
    false,
  )
})

test('computeFollowUnhideActions clears filters and expands hidden sections', () => {
  const target = {
    chatKey: 'k',
    quadrant: 2,
    agent: 'Bob',
    project: null,
    tags: [],
    kind: 'task',
  }
  const sections = [
    { key: '1', title: 'Q1', entries: [] },
    { key: '2', title: 'Q2', entries: [{ kind: 'task', task: { ...mainTask, chat_key: 'k', id: 1, agent: 'Bob' }, sortAt: 1 }] },
  ]
  const actions = computeFollowUnhideActions(target, sections, {
    agentFilter: 'Other',
    projectFilter: 'all',
    tagFilter: [],
    searchActive: true,
    collapsed: { '2': true },
    expandedSections: {},
    groupExpanded: {},
  })
  assert.equal(actions.agentFilter, 'all')
  assert.equal(actions.tagFilter?.length, 0)
  assert.equal(actions.closeSearch, true)
  assert.equal(actions.collapsed?.['2'], false)
})

test('computeFollowUnhideActions finds a chat in a project section and clears a tag filter', () => {
  const entry = i => ({ kind: 'task', task: { ...mainTask, chat_key: `c${i}`, id: i, agent: 'Bob' }, sortAt: i })
  const entries = Array.from({ length: 20 }, (_, i) => entry(i))
  const sections = [{ key: 'project:d:1', title: 'Alpha', entries }]
  const target = {
    chatKey: 'c18',
    quadrant: 1,
    agent: 'Bob',
    project: { key: 'd:1', name: 'Alpha', color: null },
    tags: [{ id: 1, name: 'x', color: 'gray', source: 'manual' }],
    kind: 'task',
  }
  const actions = computeFollowUnhideActions(
    target,
    sections,
    {
      agentFilter: 'all',
      projectFilter: ['d:1'],
      tagFilter: [1, 2],
      searchActive: false,
      collapsed: {},
      expandedSections: {},
      groupExpanded: {},
    },
    15,
  )
  assert.equal(actions.projectFilter, 'all')
  assert.deepEqual(actions.tagFilter, [])
  assert.equal(actions.expandedSections?.['project:d:1'], true)
  const keep = computeFollowUnhideActions(target, sections, {
    agentFilter: 'all',
    projectFilter: ['d:1'],
    tagFilter: [1],
    searchActive: false,
    collapsed: {},
    expandedSections: { 'project:d:1': true },
    groupExpanded: {},
  })
  assert.equal(keep.projectFilter, undefined)
})

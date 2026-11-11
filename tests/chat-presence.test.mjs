import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

const copy = {
  presenceWorking: 'Working',
  presenceWorkingAria: c => `${c} is working`,
  presenceResponded: 'Responded',
  presenceRespondedAria: c => `${c} has responded`,
  presenceRespondedUnavailable: 'Responded unknown',
  presenceRespondedUnavailableAria: 'Responded unavailable',
  presenceReadUnavailable: 'Read unknown',
  presenceReadUnavailableAria: 'Read unavailable',
}

const dir = await mkdtemp(join(tmpdir(), 'wou-presence-'))
let m
try {
  const outfile = join(dir, 'chat-presence.mjs')
  await build({
    entryPoints: ['src/ui/chatPresence.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
  })
  m = await import(new URL(`file://${outfile}`).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

const session = 'local-' + 'a'.repeat(64)
const task = {
  chat_key: session,
  chat_target: null,
  status: 'open',
  chat_title: 'Alpha',
  topic: 'Alpha',
}

const baseCaps = {
  busy: true,
  awaitingResponse: true,
  busyBySession: true,
  focusedStoredSessionId: true,
  focusedSessionId: true,
}

const snap = (overrides = {}) => ({
  caps: baseCaps,
  selection: { sessionId: session, profile: 'default', owner: null },
  busy: false,
  awaitingResponse: false,
  busyBySession: {},
  focusedSessionId: 'rt-1',
  ...overrides,
})

test('working only when focused session matches and busy atom is true', () => {
  assert.deepEqual(
    m.chatPresenceIndicators(task, snap({ busy: true, awaitingResponse: true }), copy).map(i => i.kind),
    ['working', 'read'],
  )
  assert.equal(
    m.chatPresenceIndicators(task, snap({ busy: false, awaitingResponse: true }), copy).length,
    0,
  )
  assert.equal(
    m.chatPresenceIndicators(task, snap({ busy: true, selection: { sessionId: 'other' } }), copy).length,
    0,
  )
})

test('first assistant payload does not surface as confident Responded', () => {
  const labels = m
    .chatPresenceIndicators(task, snap({ busy: true, awaitingResponse: false }), copy)
    .map(i => [i.kind, i.label])
  assert.deepEqual(labels, [
    ['working', 'Working'],
    ['read', 'Read unknown'],
  ])
  assert.deepEqual(
    m.chatPresenceIndicators(task, snap({ busy: true, awaitingResponse: true }), copy).map(i => i.kind),
    ['working', 'read'],
  )
})

test('missing awaitingResponse reports honest unavailable, never timestamp inference', () => {
  const items = m.chatPresenceIndicators(
    task,
    snap({ caps: { ...baseCaps, awaitingResponse: false }, busy: true }),
    copy,
  )
  assert.deepEqual(
    items.map(i => [i.kind, i.available ?? true, i.label]),
    [
      ['working', true, 'Working'],
      ['responded', false, 'Responded unknown'],
      ['read', false, 'Read unknown'],
    ],
  )
})

test('session switch drops working on the prior chat', () => {
  const next = snap({ busy: true, selection: { sessionId: 'local-' + 'b'.repeat(64) } })
  assert.equal(m.chatPresenceIndicators(task, next, copy).length, 0)
})

test('profile-scoped focus does not paint main chat rows (same session id)', () => {
  assert.equal(
    m.chatPresenceIndicators(
      task,
      snap({
        busy: true,
        awaitingResponse: true,
        selection: { sessionId: session, profile: 'work', owner: null },
      }),
      copy,
    ).length,
    0,
  )
})

test('not-a-chat tasks never get presence labels', () => {
  assert.equal(
    m.chatPresenceIndicators(
      { ...task, chat_key: 'mailhist:123', chat_target: null },
      snap({ busy: true }),
      copy,
    ).length,
    0,
  )
})

test('showReadUnavailable defaults on', () => {
  const kinds = m
    .chatPresenceIndicators(task, snap({ busy: true, awaitingResponse: true }), copy)
    .map(i => i.kind)
  assert.deepEqual(kinds, ['working', 'read'])
})

test('absent host snapshot yields no presence labels', () => {
  assert.equal(m.chatPresenceIndicators(task, m.ABSENT_HOST_PRESENCE_SNAPSHOT, copy).length, 0)
})

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-route-'))
  const outfile = join(dir, 'chatRoute.mjs')
  await build({ entryPoints: ['src/ui/chatRoute.ts'], outfile, bundle: true, platform: 'node', format: 'esm', target: 'es2022' })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

const { planOpen, pickRoute, contextDraft } = await load()

test('planOpen: main chat, profile chat, remote chat, non-chat source', () => {
  assert.deepEqual(planOpen('2026_a', { session_id: '2026_a', profile: null, connection: null }), { kind: 'main', sessionId: '2026_a' })
  assert.deepEqual(planOpen('2026_a', null), { kind: 'main', sessionId: '2026_a' })
  assert.deepEqual(planOpen('bob:s1', { session_id: 's1', profile: 'bob', connection: null }),
    { kind: 'profile', sessionId: 's1', profile: 'bob', connection: null })
  assert.deepEqual(planOpen('carol:s2', { session_id: 's2', profile: 'default', connection: 'carol' }),
    { kind: 'profile', sessionId: 's2', profile: 'default', connection: 'carol' })
  assert.deepEqual(planOpen('mailhist:question:a@b.com', null), { kind: 'not-a-chat', source: 'mailhist' })
  assert.deepEqual(planOpen('ntfy:abc', null), { kind: 'not-a-chat', source: 'ntfy' })
})

test('planOpen: local session keys survive a missing target', () => {
  const id = `local-${'a1'.repeat(32)}`
  assert.deepEqual(planOpen(`Work:${id}`, null), { kind: 'profile', sessionId: id, profile: 'work', connection: null })
  assert.deepEqual(planOpen(id, null), { kind: 'main', sessionId: id })
  assert.equal(planOpen('work:abcdef012345', null).kind, 'profile')
  for (const rest of [`local-${'a'.repeat(63)}`, `local-${'a'.repeat(65)}`, `local-${'z'.repeat(64)}`, `${id}:extra`]) {
    assert.equal(planOpen(`work:${rest}`, null).kind, 'not-a-chat')
  }
})

const routes = [
  { connectionId: 'local', mode: 'local', primary: true, profile: 'default', targetProfile: 'default' },
  { connectionId: 'local', mode: 'local', profile: 'bob', targetProfile: 'bob' },
  { connectionId: 'mini', mode: 'remote', profile: 'bob', targetProfile: 'bob' },
  { connectionId: 'carol', mode: 'remote', profile: 'carol', targetProfile: 'default' },
]

test('pickRoute: explicit connection must match', () => {
  assert.equal(pickRoute(routes, 'default', 'carol', 'local')?.connectionId, 'carol')
  assert.equal(pickRoute(routes, 'default', 'gone', 'local'), null)
})

test('pickRoute: no connection prefers the active one, then primary', () => {
  assert.equal(pickRoute(routes, 'bob', null, 'mini')?.connectionId, 'mini')
  assert.equal(pickRoute(routes, 'bob', null, 'local')?.connectionId, 'local')
  assert.equal(pickRoute(routes, 'default', null, 'other')?.primary, true)
})

test('contextDraft includes source, asks and excerpts', () => {
  const text = contextDraft('mailhist', 'Support mail history', [
    { topic: 'Support mail', ask: 'Is x a client?', source_excerpt: 'from x' },
    { ask: '  ' },
  ])
  assert.match(text, /support mail history\): Support mail history/)
  assert.match(text, /- Support mail: Is x a client\?/)
  assert.match(text, /Source:/)
  assert.match(text, /    from x/)
  assert.doesNotMatch(text, /- \s*$/m)
})

test('contextDraft includes multi-line excerpt and run action labels', () => {
  const text = contextDraft('mailhist', 'Inbox item', [
    {
      ask: 'Approve?',
      source_excerpt: 'line one\nline two',
      actions: [
        { id: 'send', label: 'Send', kind: 'run' },
        { id: 'skip', label: 'Skip', kind: 'run' },
        { id: 'info', label: 'Details', kind: 'details' },
      ],
    },
  ])
  assert.match(text, /    line one/)
  assert.match(text, /    line two/)
  assert.match(text, /Options on the card: Send, Skip/)
  assert.doesNotMatch(text, /Details/)
})

test('windowOptions: registered route wins, else plan values', async () => {
  const { windowOptions } = await load()
  const carol = { connectionId: 'carol', mode: 'remote', profile: 'carol', targetProfile: 'default' }
  assert.deepEqual(windowOptions({ profile: 'default', connection: 'carol' }, carol), { profile: 'carol', connectionId: 'carol' })
  assert.deepEqual(windowOptions({ profile: 'bob', connection: null }, null), { profile: 'bob', connectionId: null })
})

test('windowOptions: same-Hermes profile falls back to the active connection', async () => {
  const { windowOptions } = await load()
  assert.deepEqual(windowOptions({ profile: 'bob', connection: null }, null, 'mini-remote'), { profile: 'bob', connectionId: 'mini-remote' })
  assert.deepEqual(windowOptions({ profile: 'default', connection: 'carol' }, null, 'mini-remote'), { profile: 'default', connectionId: 'carol' })
})

test('planOpen: agent chat key without a target is still a chat', async () => {
  const { planOpen } = await load()
  assert.equal(planOpen('bob:20260101_120000_abc123', null).kind, 'profile')
  assert.equal(planOpen('mailhist:question:a@b.com', null).kind, 'not-a-chat')
})

test('pickRoute: connection aliases match a differently named client connection', async () => {
  const { pickRoute } = await load()
  const air = [{ connectionId: 'studio-mac', mode: 'remote', profile: 'default', targetProfile: 'default' }]
  assert.equal(pickRoute(air, 'default', 'carol', 'alice', ['carol', 'studio-mac'])?.connectionId, 'studio-mac')
  assert.equal(pickRoute(air, 'default', 'carol', 'alice'), null)
})

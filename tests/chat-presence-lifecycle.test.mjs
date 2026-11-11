import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

function mutableAtom(initial) {
  let value = initial
  const subs = new Set()
  return {
    get: () => value,
    set(next) {
      value = next
      for (const fn of subs) fn(value)
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-presence-life-'))
  const outfile = join(dir, 'bundle.mjs')
  await build({
    entryPoints: ['src/ui/chatPresenceLifecycle.harness.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
  })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

const session = 'local-' + 'c'.repeat(64)
const task = {
  chat_key: session,
  chat_target: null,
  status: 'open',
  chat_title: 'Beta',
  topic: 'Beta',
}

test('mocked atom lifecycle paints expected row labels', async () => {
  const { labelsForHostMock } = await load()

  const focusedStored = mutableAtom(session)
  const focusedRuntime = mutableAtom('rt-focus')
  const active = mutableAtom(null)
  const profile = mutableAtom('default')
  const owner = mutableAtom(null)
  const busy = mutableAtom(false)
  const awaiting = mutableAtom(false)
  const busyMap = mutableAtom({ 'rt-focus': false })
  const capsState = {
    busy: {},
    awaitingResponse: {},
    busyBySession: {},
    focusedStoredSessionId: {},
    focusedSessionId: {},
  }

  const mock = () => ({
    capsState,
    focusedStored,
    focusedRuntime,
    active,
    profile,
    owner,
    busy,
    awaiting,
    busyMap,
    task,
  })

  const read = () => labelsForHostMock(mock())

  assert.deepEqual(read(), [])

  busy.set(true)
  awaiting.set(true)
  busyMap.set({ 'rt-focus': true })
  assert.deepEqual(read(), ['Working', 'Read unknown'])

  awaiting.set(false)
  assert.deepEqual(read(), ['Working', 'Read unknown'])

  focusedStored.set('local-' + 'd'.repeat(64))
  assert.deepEqual(read(), [])

  focusedStored.set(session)
  busy.set(true)
  awaiting.set(true)
  assert.deepEqual(read(), ['Working', 'Read unknown'])

  delete capsState.awaitingResponse
  assert.deepEqual(read(), ['Working', 'Responded unknown', 'Read unknown'])
})

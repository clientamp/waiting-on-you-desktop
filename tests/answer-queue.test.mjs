import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-answer-queue-'))
  const outfile = join(dir, 'answerQueue.mjs')
  await build({
    entryPoints: ['src/ui/answerQueue.ts'],
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

const { createAnswerQueue } = await load()

/** Manual clock: timers fire only when the test advances time. */
function harness({ open = () => true, deliver, claims } = {}) {
  let now = 0
  let nextId = 1
  const timers = new Map()
  const log = []
  const pendingDeliveries = []
  const q = createAnswerQueue({
    delayMs: 5000,
    setTimer: (fn, ms) => {
      const id = nextId++
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimer: id => timers.delete(id),
    isStillOpen: id => open(id),
    deliver:
      deliver ??
      ((item, signal) =>
        new Promise(resolve => {
          log.push(`deliver:${item.taskId}`)
          pendingDeliveries.push({ item, resolve, signal })
        })),
    ...(claims ? { claims } : {}),
    onSent: item => log.push(`sent:${item.taskId}`),
    onFailed: (item, reason) => log.push(`failed:${item.taskId}:${reason}`),
    onChange: () => {},
  })
  const advance = async ms => {
    now += ms
    for (const [id, t] of [...timers.entries()].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at <= now) {
        timers.delete(id)
        t.fn()
      }
    }
    await flush()
  }
  return { q, log, advance, pendingDeliveries, timers }
}

const flush = () => new Promise(resolve => setImmediate(resolve))
const scopeA = { profile: 'default', connectionId: null }
const scopeB = { profile: 'studio', connectionId: 'conn-b' }
const item = (taskId, text = 'Yes.', scope = scopeA) => ({
  taskId,
  sessionId: `s${taskId}`,
  text,
  label: 'Yes',
  chatTitle: `Chat ${taskId}`,
  scope,
})

test('nothing is sent before the delay', async () => {
  const h = harness()
  assert.equal(h.q.enqueue(item(1)), true)
  assert.equal(h.q.phase(1), 'waiting')
  await h.advance(4999)
  assert.deepEqual(h.log, [])
  await h.advance(1)
  assert.deepEqual(h.log, ['deliver:1'])
  assert.equal(h.q.phase(1), 'sending')
  h.pendingDeliveries[0].resolve(true)
  await flush()
  assert.deepEqual(h.log, ['deliver:1', 'sent:1'])
  assert.equal(h.q.phase(1), null)
})

test('cancel during the wait means nothing is ever sent', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  await h.advance(2000)
  assert.equal(h.q.cancel(1), true)
  await h.advance(10000)
  assert.deepEqual(h.log, [])
  assert.equal(h.q.phase(1), null)
  assert.equal(h.timers.size, 0)
})

test('cancelLatest undoes the most recent waiting answer only', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  await h.advance(1000)
  h.q.enqueue(item(2))
  assert.equal(h.q.cancelLatest().taskId, 2)
  assert.equal(h.q.phase(1), 'waiting')
  assert.equal(h.q.cancelLatest().taskId, 1)
  assert.equal(h.q.cancelLatest(), null)
  await h.advance(10000)
  assert.deepEqual(h.log, [])
})

test('a send already in flight cannot be cancelled', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  await h.advance(5000)
  assert.equal(h.q.phase(1), 'sending')
  assert.equal(h.q.cancel(1), false)
  assert.equal(h.q.cancelLatest(), null)
})

test('one pending answer per task: a second is refused', async () => {
  const h = harness()
  assert.equal(h.q.enqueue(item(1, 'Yes.')), true)
  assert.equal(h.q.enqueue(item(1, 'No.')), false)
  await h.advance(5000)
  assert.equal(h.q.enqueue(item(1, 'No.')), false)
  h.pendingDeliveries[0].resolve(true)
  await flush()
  assert.deepEqual(h.log, ['deliver:1', 'sent:1'])
})

test('sends go one at a time, in the order they were answered', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  await h.advance(100)
  h.q.enqueue(item(2))
  await h.advance(100)
  h.q.enqueue(item(3))
  await h.advance(6000)
  assert.deepEqual(h.log, ['deliver:1'])
  assert.equal(h.q.phase(2), 'waiting')
  h.pendingDeliveries[0].resolve(true)
  await flush()
  assert.deepEqual(h.log, ['deliver:1', 'sent:1', 'deliver:2'])
  h.pendingDeliveries[1].resolve(false)
  await flush()
  assert.deepEqual(h.log, ['deliver:1', 'sent:1', 'deliver:2', 'failed:2:not-delivered', 'deliver:3'])
  h.pendingDeliveries[2].resolve(true)
  await flush()
  assert.equal(h.log.at(-1), 'sent:3')
  assert.equal(h.q.size(), 0)
})

test('a task closed during the wait is dropped, not sent', async () => {
  let isOpen = true
  const h = harness({ open: () => isOpen })
  h.q.enqueue(item(1))
  isOpen = false
  await h.advance(5000)
  assert.deepEqual(h.log, ['failed:1:gone'])
})

test('a delivery that throws fails closed and the queue keeps going', async () => {
  const delivered = []
  const h = harness({
    deliver: async it => {
      delivered.push(it.taskId)
      if (it.taskId === 1) throw new Error('boom')
      return true
    },
  })
  h.q.enqueue(item(1))
  h.q.enqueue(item(2))
  await h.advance(5000)
  await flush()
  assert.deepEqual(delivered, [1, 2])
  assert.deepEqual(h.log, ['failed:1:error', 'sent:2'])
})

test('dispose cancels everything still waiting', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  h.q.enqueue(item(2))
  h.q.dispose()
  await h.advance(10000)
  assert.deepEqual(h.log, [])
  assert.equal(h.q.size(), 0)
  assert.equal(h.q.enqueue(item(3)), false)
})

test('dispose stops a send in flight; a stopped send stays quiet', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  await h.advance(5000)
  assert.deepEqual(h.log, ['deliver:1'])
  h.q.dispose()
  assert.equal(h.pendingDeliveries[0].signal.aborted, true)
  h.pendingDeliveries[0].resolve(false)
  await flush()
  assert.deepEqual(h.log, ['deliver:1'])
})

test('after dispose, a send that already went out still reports so its ask closes', async () => {
  const h = harness()
  h.q.enqueue(item(1))
  await h.advance(5000)
  h.q.dispose()
  h.pendingDeliveries[0].resolve(true)
  await flush()
  assert.deepEqual(h.log, ['deliver:1', 'sent:1'])
})

test('a reopened panel cannot answer a task whose send is still in flight', async () => {
  const claims = new Set()
  const first = harness({ claims })
  first.q.enqueue(item(1))
  await first.advance(5000)
  first.q.dispose()
  const second = harness({ claims })
  assert.equal(second.q.enqueue(item(1)), false)
  first.pendingDeliveries[0].resolve(false)
  await flush()
  assert.equal(second.q.enqueue(item(1)), true)
})

test('cancel and dispose release the claim on a waiting answer', async () => {
  const claims = new Set()
  const h = harness({ claims })
  h.q.enqueue(item(1))
  h.q.enqueue(item(2))
  h.q.cancel(1)
  assert.deepEqual([...claims], [2])
  h.q.dispose()
  assert.deepEqual([...claims], [])
})

test('cancelOutOfScope drops waiting answers that no longer match this window', async () => {
  const h = harness()
  h.q.enqueue(item(1, 'Yes.', scopeA))
  h.q.enqueue(item(2, 'Yes.', scopeB))
  assert.equal(h.q.cancelOutOfScope(scopeA), 1)
  assert.equal(h.q.phase(1), 'waiting')
  assert.equal(h.q.phase(2), null)
  assert.deepEqual(h.log, ['failed:2:not-delivered'])
  await h.advance(10000)
  assert.deepEqual(h.log, ['failed:2:not-delivered', 'deliver:1'])
})

test('cancelOutOfScope latches aborted on an in-flight out-of-scope answer, keeps its claim until delivery settles, and stays aborted if scope returns', async () => {
  const claims = new Set()
  const pending = []
  const h = harness({
    claims,
    deliver: (item, signal) =>
      new Promise(resolve => {
        h.log.push(`deliver:${item.taskId}`)
        pending.push({
          item,
          signal,
          resolve: ok => resolve(Boolean(ok) && !signal.aborted),
        })
      }),
  })
  h.q.enqueue(item(2, 'Yes.', scopeB))
  await h.advance(5000)
  assert.equal(h.q.phase(2), 'sending')
  assert.equal(h.q.cancelOutOfScope(scopeA), 1)
  assert.equal(pending[0].signal.aborted, true)
  assert.deepEqual([...claims], [2])
  pending[0].resolve(true)
  await flush()
  assert.deepEqual(h.log, ['deliver:2', 'failed:2:not-delivered'])
  assert.deepEqual([...claims], [])
  assert.equal(h.q.phase(2), null)
})

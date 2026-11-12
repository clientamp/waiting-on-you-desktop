import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { build } from 'esbuild'
import test from 'node:test'

async function load(host) {
  const result = await build({
    entryPoints: ['src/ui/openChat.ts'], bundle: true, write: false,
    platform: 'node', format: 'esm',
    plugins: [{ name: 'test-sdk', setup(b) {
      b.onResolve({ filter: /^@hermes\/plugin-sdk$/ }, () => ({ path: 'sdk', namespace: 'test-sdk' }))
      b.onLoad({ filter: /.*/, namespace: 'test-sdk' }, () => ({ contents: 'export const host = globalThis.__wouWindowTestHost' }))
    } }],
  })
  globalThis.__wouWindowTestHost = { notify() {}, ...host }
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`)
  } finally { delete globalThis.__wouWindowTestHost }
}

const route = { connectionId: 'hub', mode: 'remote', profile: 'hub-helper', targetProfile: 'helper' }
const target = { session_id: 'session-123', profile: 'helper', connection: null }

test('another-profile chat uses the public SDK window intent with its registered route', async () => {
  const calls = []
  const host = {
    openSession: async (...args) => calls.push(args),
    navigate: () => assert.fail('must not navigate this window'),
    profileRoutes: async () => [route],
    state: { connectionId: { get: () => 'hub' } },
  }
  const { openChat } = await load(host)
  await openChat({}, 'helper:session-123', 'Example chat', target)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], ['session-123', { intent: 'window', profile: 'helper', route }])
  assert.equal('awaitHydration' in calls[0][1], false)
})

test('another-profile chat without a registered route still uses the SDK profile hint', async () => {
  const calls = []
  const { openChat } = await load({
    openSession: async (...args) => calls.push(args), navigate() {},
    state: { connectionId: { get: () => null } },
  })
  await openChat({}, 'helper:session-123', 'Example chat', target)
  assert.deepEqual(calls, [['session-123', { intent: 'window', profile: 'helper' }]])
})

test('hosts without the public SDK session method retain the in-place navigation fallback', async () => {
  const paths = []
  const { openChat } = await load({
    navigate: path => paths.push(path),
    state: { connectionId: { get: () => null } },
  })
  await openChat({}, 'helper:session-123', 'Example chat', target)
  assert.deepEqual(paths, ['/session-123'])
})

test('main-profile chats retain their SDK in-place intent', async () => {
  const calls = []
  const { openChat } = await load({ openSession: async (...args) => calls.push(args), navigate() {} })
  await openChat({}, 'session-123', 'Example chat', null)
  assert.deepEqual(calls, [['session-123', { intent: 'in-place' }]])
})

test('source and shipped bundle never reference the private Desktop bridge', async () => {
  for (const entry of await readdir('src', { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) assert.doesNotMatch(await readFile(`${entry.parentPath}/${entry.name}`, 'utf8'), /hermesDesktop/)
  }
  assert.doesNotMatch(await readFile('desktop/plugin.js', 'utf8'), /hermesDesktop/)
})

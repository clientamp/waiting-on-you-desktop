import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-open-chat-'))
  const mockSdk = join(dir, 'hermes-plugin-sdk.mjs')
  await writeFile(mockSdk, `export const host = { navigate() {} }\nexport class PluginContext {}\n`)
  const outfile = join(dir, 'openChat.mjs')
  await build({
    entryPoints: ['src/ui/openChat.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    alias: { '@hermes/plugin-sdk': mockSdk },
  })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

const { openNewChatWithContext } = await load()

/** Shared wrapper for regressions: navigate, composer, text, onReady, onBlockedDraft. */
export async function exerciseOpenNewChatWithContext({
  navigate = () => {},
  composer,
  text = 'context block',
  onReady = () => {},
  onBlockedDraft = () => {},
}) {
  await openNewChatWithContext(navigate, composer, text, onReady, onBlockedDraft)
}

test('openNewChatWithContext does not overwrite a non-empty new-chat draft', async () => {
  let draft = 'keep me'
  let navigatePath = null
  let ready = 0
  let blocked = 0
  const composer = {
    getDraft: async id => (id === 'new' ? draft : null),
    setDraft: async (id, text) => {
      if (id === 'new') draft = text
      return true
    },
  }
  await openNewChatWithContext(
    path => {
      navigatePath = path
    },
    composer,
    'context block',
    () => {
      ready++
    },
    () => {
      blocked++
    },
  )
  assert.equal(navigatePath, '/')
  assert.equal(draft, 'keep me')
  assert.equal(ready, 0)
  assert.equal(blocked, 1)
})

test('openNewChatWithContext fills an empty new-chat draft', async () => {
  let draft = ''
  let ready = 0
  const composer = {
    getDraft: async id => (id === 'new' ? draft : null),
    setDraft: async (id, text) => {
      if (id === 'new') draft = text
      return true
    },
  }
  await openNewChatWithContext(
    () => {},
    composer,
    'filled in',
    () => {
      ready++
    },
    () => {},
  )
  assert.equal(draft, 'filled in')
  assert.equal(ready, 1)
})

test('openNewChatWithContext rechecks the draft immediately before each setDraft attempt', async () => {
  let reads = 0
  let writes = 0
  let blocked = 0
  const composer = {
    getDraft: async id => {
      if (id !== 'new') return null
      reads++
      return reads === 1 ? '' : 'user beat the mount'
    },
    setDraft: async () => {
      writes++
      return false
    },
  }
  await exerciseOpenNewChatWithContext({
    composer,
    text: 'should not land',
    onBlockedDraft: () => {
      blocked++
    },
  })
  assert.equal(blocked, 1)
  assert.equal(writes, 0)
  assert.ok(reads >= 2)
})

test('openNewChatWithContext without getDraft never writes the draft', async () => {
  let writes = 0
  let blocked = 0
  const composer = {
    setDraft: async () => {
      writes++
      return true
    },
  }
  await assert.rejects(
    () =>
      exerciseOpenNewChatWithContext({
        composer,
        text: 'should not land',
        onBlockedDraft: () => {
          blocked++
        },
      }),
    /could not fill the new chat/,
  )
  assert.equal(writes, 0)
  assert.equal(blocked, 0)
})

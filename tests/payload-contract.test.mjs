import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-payload-'))
  const outfile = join(dir, 'answers.mjs')
  await build({
    entryPoints: ['src/ui/answers.ts'],
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

const m = await load()

test('a reply clip does not split an emoji at the character boundary', () => {
  const reply = 'a'.repeat(m.REPLY_MAX_CHARS - 1) + '😀'
  const msg = m.answerMessage('reply', 'Ask', reply)
  const answer = msg.split('\n')[0]
  assert.equal(answer.includes('\uD83D') && !answer.includes('😀'), false)
  assert.doesNotMatch(answer, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
})

test('a long CJK reply is kept, and a 4096-byte envelope is not treated as that allowance', () => {
  const cjk = '字'.repeat(1500)
  const msg = m.answerMessage('reply', 'Ask', cjk)
  assert.ok(msg.startsWith(cjk))
  assert.equal(m.fitsPayload(cjk, 2000, 4096), false)
  assert.equal(m.fitsPayload(cjk, m.REPLY_MAX_CHARS, m.REPLY_MAX_UTF8_BYTES), true)
  const quoted = '"'.repeat(2048)
  assert.equal(m.serializedPayloadFits({ text: quoted }, 4000, 4096), false)
  assert.equal(m.serializedPayloadFits({ text: cjk }, 4000, m.REPLY_MAX_UTF8_BYTES), true)
})

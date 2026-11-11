import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadStyles() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-composer-spacing-'))
  const outfile = join(dir, 'styles.mjs')
  await build({
    entryPoints: ['src/ui/styles.ts'],
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

// The trigger button itself carries both `wou-root` and `wou-composer-trigger`,
// so descendant selectors (`.wou-root .wou-composer-trigger`) never match it.
// Desktop only leaves a 4px gap before the model pill, whose text has no left
// padding, so the button needs its own trailing margin from a compound rule.
function compoundTriggerRule(css, root) {
  const re = new RegExp(`\\.${root}\\.wou-composer-trigger\\s*\\{([^}]*)\\}`)
  return css.match(re)?.[1] ?? null
}

test('composer trigger keeps space before the model pill', async () => {
  const { composerTriggerStyles, ROOT_CLASS } = await loadStyles()
  const body = compoundTriggerRule(composerTriggerStyles, ROOT_CLASS)
  assert.ok(body, 'expected a compound .wou-root.wou-composer-trigger rule')
  const m = body.match(/margin-inline-end:\s*(\d+)px/)
  assert.ok(m, 'expected margin-inline-end in px')
  assert.ok(Number(m[1]) >= 6, `margin ${m[1]}px is too tight`)
  assert.match(body, /position:\s*relative/, 'badge needs a positioned trigger')
})

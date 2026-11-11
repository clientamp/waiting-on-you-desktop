import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

const require = createRequire(import.meta.url)
const playwrightPath = process.env.WOU_TEST_PLAYWRIGHT

async function loadStyles() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-answer-contrast-'))
  const outfile = join(dir, 'styles.mjs')
  await build({ entryPoints: ['src/ui/styles.ts'], outfile, bundle: true, platform: 'node', format: 'esm', target: 'es2022' })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

function rulesFor(css, selectorPart) {
  const out = []
  const re = /([^{}]+)\{([^}]*)\}/g
  let m
  while ((m = re.exec(css))) if (m[1].includes(selectorPart)) out.push({ selector: m[1].trim(), body: m[2] })
  return out
}

// Answer buttons must keep one text/background pair in every state. Blending the fill
// toward the text colour on hover/press drops contrast below 4.5:1 in low-contrast themes.
test('answer buttons never blend their fill in hover or pressed states', async () => {
  const { globalStyles } = await loadStyles()
  const rules = rulesFor(globalStyles, '.wou-answer-bar .wou-action-btn')
  assert.ok(rules.length > 0, 'expected answer-bar button rules')
  for (const { selector, body } of rules) {
    const bg = body.match(/background(?:-color)?:\s*([^;]+);/)
    if (bg) assert.doesNotMatch(bg[1], /color-mix/, `${selector} blends its background`)
    const fg = body.match(/(?:^|[\s;])color:\s*([^;]+);/)
    if (fg) assert.doesNotMatch(fg[1], /color-mix/, `${selector} blends its text colour`)
  }
  const yes = rules.filter(r => r.selector.includes('.wou-answer-yes'))
  assert.ok(yes.some(r => /:active/.test(r.selector)), 'Yes needs its own pressed rule after the generic one')
  for (const { body } of yes) {
    if (/background:/.test(body)) assert.match(body, /background:\s*var\(--dt-primary-solid,\s*var\(--wou-fg\)\)/)
    if (/(?:^|[\s;])color:/.test(body)) assert.match(body, /color:\s*var\(--dt-primary-solid-foreground,\s*var\(--wou-card\)\)/)
  }
})

// Public Hermes preset values for the lowest-contrast palettes, plus `solid`, the
// --dt-primary-solid Desktop derives for each (ensureContrast(primary, #fcfcfc, 4.5)).
const PALETTES = {
  'everforest-light': { fg: '#5c6a72', card: '#fdf6e3', border: '#fdf6e3', accent: '#586b35', solid: '#586b35' },
  'solarized-dark': { fg: '#839496', card: '#002b36', border: '#234751', accent: '#6ea1c4', solid: '#426176' },
  'catppuccin-dark': { fg: '#cdd6f4', card: '#181825', border: '#585b70', accent: '#cba6f7', solid: '#7a6494' },
  'github-dark': { fg: '#e6edf3', card: '#010409', border: '#30363d', accent: '#4f9e5e', solid: '#3f7e4b' },
  'cyberpunk': { fg: '#00ff41', card: '#001200', border: '#003000', accent: '#00ff41', solid: '#00661a' },
  'nous-light': { fg: '#1f2328', card: '#f6f8fa', border: '#d0d7de', accent: '#0053fd', solid: '#0053fd' },
}

test('answer buttons keep 4.5:1 text contrast at rest, hover and keyboard press', {
  skip: !playwrightPath ? 'set WOU_TEST_PLAYWRIGHT for the answer-button contrast check' : false,
  timeout: 60_000,
}, async () => {
  const { globalStyles } = await loadStyles()
  const { chromium } = require(playwrightPath)
  const browser = await chromium.launch({ headless: true })
  const failures = []
  try {
    const page = await browser.newPage()
    for (const [name, p] of Object.entries(PALETTES)) {
      for (const host of ['solid', 'no-solid']) {
        const solid = host === 'solid'
          ? `--dt-primary-solid:${p.solid};--dt-primary-solid-foreground:#fcfcfc;` : ''
        await page.setContent(`<style>:root{--dt-foreground:${p.fg};--dt-card:${p.card};--dt-border:${p.border};--ui-accent:${p.accent};${solid}}
body{margin:0;background:${p.card}} ${globalStyles}</style>
<div class="wou-root"><div class="wou-answer-bar"><button class="wou-action-btn wou-answer-yes">Yes</button><button class="wou-action-btn">No</button></div></div>`)
        for (const label of ['Yes', 'No']) {
          const btn = page.getByRole('button', { name: label })
          const read = () => btn.evaluate(e => {
            const toRgb = c => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3) }
            const lum = rgb => { const v = rgb.map(n => n / 255).map(n => n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
            const s = getComputedStyle(e)
            const [a, b] = [lum(toRgb(s.color)), lum(toRgb(s.backgroundColor))].sort((x, y) => y - x)
            return (a + 0.05) / (b + 0.05)
          })
          await page.mouse.move(0, 400)
          const rest = await read()
          await btn.hover()
          const hover = await read()
          await page.mouse.move(0, 400)
          await btn.focus()
          await page.keyboard.down('Space')
          const pressed = await read()
          await page.keyboard.up('Space')
          for (const [state, ratio] of [['rest', rest], ['hover', hover], ['pressed', pressed]]) {
            if (ratio < 4.5) failures.push(`${name}/${host}/${label}/${state}: ${ratio.toFixed(2)}:1`)
          }
        }
      }
    }
  } finally {
    await browser.close()
  }
  assert.deepEqual(failures, [])
})

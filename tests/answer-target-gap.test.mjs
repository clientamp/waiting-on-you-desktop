import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')

test('remote and other-profile answers stay Open-only, with a documented gap', () => {
  const gap = read('docs/known-gaps.md')
  assert.match(gap, /Inline answers stop at this window/)
  assert.match(gap, /Nothing is sent/)
  assert.match(gap, /Do not send an inline answer to a remote chat or another profile/)
  assert.doesNotMatch(gap, /host\.navigate\(\s*['"`]\/kanban\?/)

  const answers = read('src/ui/answers.ts')
  assert.match(answers, /export const ANSWER_DELAY_MS = 5000/)
  assert.match(answers, /unsupportedAnswerReason/)
  assert.match(
    answers,
    /export function canAnswerInPanel\([\s\S]*?scope\??:\s*AnswerWindowScope\s*=\s*\{\s*profile:\s*['"]default['"],\s*connectionId:\s*null\s*\}/,
  )
  assert.doesNotMatch(answers, /setDraft/)
  assert.doesNotMatch(answers, /openSession/)

  const bar = read('src/ui/AnswerBar.tsx')
  assert.match(bar, /wou-answer-unsupported/)
  assert.match(bar, /role="note"/)
  assert.match(bar, /\{strings\.answerYes\}/)
  assert.match(bar, /\{strings\.answerNo\}/)
  assert.match(bar, /\{strings\.answerReply\}/)
  assert.match(bar, /\{strings\.answerLater\}/)
  assert.match(bar, /\{openLabel\}/)
  assert.match(bar, /canAnswer && yesNo/)
  assert.match(bar, /\{canAnswer \?/)
  assert.match(bar, /strings\.answerUndo/)
  assert.doesNotMatch(bar, /deliverToChat|composer\.submit|openSession/)

  const row = read('src/ui/TaskRow.tsx')
  assert.match(row, /unsupportedNote=\{unsupportedAnswerReason\(task\) \? strings\.answerUnsupported : null\}/)
  assert.match(row, /\{cardActions\}/)
  assert.match(row, /\{overflowMenu\}/)
  assert.match(row, /\{nested \? overflowMenu : null\}/)
  assert.match(row, /inNextUp \|\| isActive \|\| answers\.showAll/)
  assert.doesNotMatch(row, /layout ===/)

  const panel = read('src/ui/TasksPanel.tsx')
  assert.match(panel, /delayMs: ANSWER_DELAY_MS/)
  assert.match(panel, /if \(!queue \|\| !canAnswerInPanel\(task, canSubmit, readAnswerWindowScope\(\)\)\) return/)
  assert.match(panel, /canSubmit:\s*canSubmit\s*&&[\s\S]{0,500}readAnswerWindowScope\(\)/)
  assert.match(
    panel,
    /canSubmit:\s*canSubmit\s*&&\s*readAnswerWindowScope\(\)\.profile\s*===\s*['"]default['"]/,
  )
  assert.match(panel, /const onShift = \(\) => \{[\s\S]*?setAnswerTick/)
  assert.match(panel, /if \(unsupportedAnswerReason\(task\)\) return/)
  assert.match(panel, /if \(plan\.kind !== 'main'\) return/)
  assert.match(panel, /if \(!canAnswer \|\| !isYesNoAsk\(task\.ask\)\) return/)
  assert.match(panel, /if \(!canAnswer\) return/)
  assert.match(panel, /if \(!target \|\| !el\.contains\(target\)\) return/)
  assert.match(panel, /claims: answerClaims/)
  assert.match(panel, /wou-layout-\$\{layout\}/)
  assert.match(panel, /renderTaskRow\(nextUp\.task, true, nextUp\.group != null\)/)

  const group = read('src/ui/TaskGroupRow.tsx')
  assert.match(group, /<TaskRow/)
  assert.match(group, /nested/)

  const nextUp = read('src/ui/NextUpCard.tsx')
  assert.match(nextUp, /\{children\}/)

  const css = read('src/ui/styles.ts')
  for (const layout of ['cards', 'compact', 'focus']) {
    assert.doesNotMatch(
      css,
      new RegExp(`wou-layout-${layout}[^\\n]*wou-card-actions[^\\n]*display:\\s*none`),
    )
    assert.doesNotMatch(
      css,
      new RegExp(`wou-layout-${layout}[^\\n]*wou-menu-anchor[^\\n]*display:\\s*none`),
    )
    assert.doesNotMatch(
      css,
      new RegExp(`wou-layout-${layout}[^\\n]*wou-row-nested[^\\n]*wou-card-actions[^\\n]*display:\\s*none`),
    )
  }
  assert.match(css, /\.wou-card-actions \{[^}]*display:\s*flex/)
  assert.match(css, /\.wou-answer-unsupported \{/)
})

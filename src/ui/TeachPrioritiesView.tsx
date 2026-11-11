import type { PluginContext } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { answerQuiz, fetchQuiz, skipQuiz } from './api'
import {
  QUADRANT_CHOICES,
  QUIZ_BATCH,
  currentQuizItem,
  filedAsLabel,
  initialQuizState,
  quizKeyAction,
  quizMetaLine,
  quizProgressLabel,
  quizReducer,
  type Quadrant,
} from './priorityHelpers'
import { DueChip } from './TagChips'
import { isAlreadyGone, restErrorFields } from './sessionApi'
import { strings } from './strings'

interface TeachPrioritiesViewProps {
  ctx: PluginContext
  now: Date
  /** Shown on the empty state while the first scan runs. */
  scanning?: boolean
  onBack: (sorted: number) => void
  /** Called after each saved answer so the main list can refresh. */
  onAnswered: (saved: boolean) => void
}

function isGone(e: unknown): boolean {
  if (isAlreadyGone(e)) return true
  const { status, error } = restErrorFields(e)
  return status === 404 && /open task not found/i.test(error)
}

export function TeachPrioritiesView({ ctx, now, scanning, onBack, onAnswered }: TeachPrioritiesViewProps) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState)
  const rootRef = useRef<HTMLDivElement>(null)
  // Never count skips or tasks that were already gone.
  const sortedRef = useRef(0)
  const leave = () => onBack(sortedRef.current)
  const item = currentQuizItem(state)

  const load = useCallback(async () => {
    dispatch({ type: 'load' })
    try {
      dispatch({ type: 'loaded', items: await fetchQuiz(ctx, QUIZ_BATCH) })
    } catch {
      dispatch({ type: 'loadFailed', error: strings.teachLoadError })
    }
  }, [ctx])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  // At the end of a batch, check whether another one is waiting.
  useEffect(() => {
    if (state.status !== 'done' || state.moreAvailable !== null) return
    let live = true
    void fetchQuiz(ctx, 1)
      .then(items => live && dispatch({ type: 'more', available: items.length > 0 }))
      .catch(() => live && dispatch({ type: 'more', available: false }))
    return () => {
      live = false
    }
  }, [ctx, state.status, state.moreAvailable])

  const submit = useCallback(
    async (choice: Quadrant | 'skip') => {
      if (!item || state.busy) return
      dispatch({ type: 'submit' })
      try {
        if (choice === 'skip') {
          await skipQuiz(ctx, item.id)
          dispatch({ type: 'skipped' })
        } else {
          await answerQuiz(ctx, item.id, choice)
          sortedRef.current += 1
          dispatch({ type: 'answered' })
          onAnswered(true)
        }
      } catch (e) {
        if (isGone(e)) {
          dispatch({ type: 'gone' })
          onAnswered(false)
          return
        }
        dispatch({ type: 'submitFailed', error: restErrorFields(e).error || strings.teachSaveError })
      }
    },
    [ctx, item, state.busy, onAnswered],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    if (e.key === 'Escape') {
      e.preventDefault()
      leave()
      return
    }
    const action = quizKeyAction(e)
    if (action == null || !item) return
    e.preventDefault()
    void submit(action)
  }

  return (
    <div
      className="wou-settings-view wou-teach"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-labelledby="wou-teach-title"
    >
      <div className="wou-settings-view-header">
        <button type="button" className="wou-link wou-settings-back" onClick={leave}>
          {strings.settingsBack}
        </button>
        <h2 id="wou-teach-title" className="wou-settings-view-title">
          {strings.teachTitle}
        </h2>
        {item ? (
          <span className="wou-muted wou-teach-progress" aria-live="polite">
            {quizProgressLabel(state)}
          </span>
        ) : null}
      </div>

      {state.status === 'loading' ? (
        <p className="wou-muted" role="status">{strings.teachLoading}</p>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert">
          {state.error ?? strings.teachLoadError}{' '}
          <button type="button" className="wou-link" onClick={() => void load()}>
            {strings.retry}
          </button>
        </p>
      ) : null}

      {state.status === 'empty' ? (
        <div className="wou-teach-end">
          <p>{strings.teachEmpty}</p>
          {scanning ? <p className="wou-muted">{strings.firstRunTeachWait}</p> : null}
          <p className="wou-muted">{strings.teachEmptyNote}</p>
          <button type="button" className="wou-btn-compact" onClick={leave}>
            {strings.teachDone}
          </button>
        </div>
      ) : null}

      {state.status === 'done' ? (
        <div className="wou-teach-end" role="status">
          <p>{state.sorted > 0 ? strings.teachFinished(state.sorted) : strings.teachFinishedNone}</p>
          <div className="wou-teach-end-actions">
            {state.moreAvailable ? (
              <button type="button" className="wou-btn-compact" onClick={() => void load()}>
                {strings.teachMore}
              </button>
            ) : null}
            <button type="button" className="wou-btn-compact" onClick={leave}>
              {strings.teachDone}
            </button>
          </div>
        </div>
      ) : null}

      {item ? (
        <div className="wou-teach-card">
          {state.index === 0 && state.sorted === 0 ? (
            <p className="wou-muted wou-teach-intro">{strings.teachIntro}</p>
          ) : null}
          <p className="wou-teach-ask">{item.ask}</p>
          {item.context ? <p className="wou-teach-context">{item.context}</p> : null}
          <p className="wou-muted wou-teach-meta">
            <span>{quizMetaLine(item)}</span>
            <DueChip dueAt={item.due_at} now={now} />
          </p>
          <p className="wou-muted wou-teach-filed">{filedAsLabel(item.quadrant)}</p>
          <div className="wou-teach-choices" role="group" aria-label={strings.teachTitle}>
            {QUADRANT_CHOICES.map(choice => (
              <button
                key={choice.quadrant}
                type="button"
                className={`wou-teach-choice wou-teach-choice-q${choice.quadrant}${
                  item.quadrant === choice.quadrant ? ' wou-teach-choice-current' : ''
                }`}
                disabled={state.busy}
                onClick={() => void submit(choice.quadrant)}
                aria-keyshortcuts={String(choice.quadrant)}
              >
                <kbd className="wou-keycap" aria-hidden="true">{choice.quadrant}</kbd>
                <span className="wou-teach-choice-label">{choice.label}</span>
                <span className="wou-muted wou-teach-choice-hint">{choice.hint}</span>
              </button>
            ))}
          </div>
          {state.error ? (
            <p className="wou-teach-error" role="alert">
              {state.error} <span className="wou-muted">{strings.teachSaveRetry}</span>
            </p>
          ) : null}
          <div className="wou-teach-footer">
            <button
              type="button"
              className="wou-btn-compact"
              disabled={state.busy}
              onClick={() => void submit('skip')}
              aria-keyshortcuts="S"
            >
              {strings.teachSkip} <kbd className="wou-keycap" aria-hidden="true">S</kbd>
            </button>
            <button type="button" className="wou-link" onClick={leave}>
              {strings.teachDone}
            </button>
            <span className="wou-muted wou-teach-keys">{strings.teachKeysHint}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

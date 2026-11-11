import { useEffect, useRef, useState } from 'react'
import type { Task } from '../model'
import type { AnswerControls } from './answerContext'
import { REPLY_MAX_CHARS } from './answers'
import { IconExternalLink } from './icons'
import { strings } from './strings'

interface AnswerBarProps {
  task: Task
  controls: AnswerControls
  /** Show the buttons (active task, ⌘⌥A, or the Next up box). Pending status shows regardless. */
  visible: boolean
  /** The chat opens in this window and Desktop can send into it. */
  canAnswer: boolean
  yesNo: boolean
  /** Label for the open button ("Open session" or "Handle with <agent>"). */
  openLabel: string
  /** Set for a remote or other-profile chat. Explains why Yes/No/Reply are absent. Never a send. */
  unsupportedNote?: string | null
  /** Next up keeps a plain Done (mark done without telling the agent). */
  onDone?: () => void
  disabled?: boolean
}

/** Yes · No · Reply · Later · Open session, plus the "Sending… Undo" state. */
export function AnswerBar({
  task,
  controls,
  visible,
  canAnswer,
  yesNo,
  openLabel,
  unsupportedNote = null,
  onDone,
  disabled = false,
}: AnswerBarProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState('')
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const phase = controls.phase(task.id)
  const request = controls.replyRequest

  // R on the active row opens the reply box. Only requests made after this row
  // mounted count, so a row that re-mounts doesn't reopen an old one.
  const seenReply = useRef(request?.n ?? 0)
  useEffect(() => {
    if (!request || request.n <= seenReply.current) return
    seenReply.current = request.n
    if (request.taskId === task.id && canAnswer) setReplyOpen(true)
  }, [request?.n, request?.taskId, task.id, canAnswer])

  useEffect(() => {
    if (!replyOpen) return
    const el = replyRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest' })
  }, [replyOpen])

  if (phase) {
    const label = controls.answerLabel(task.id) ?? ''
    return (
      <div className="wou-answer-pending" role="status">
        <span>{phase === 'waiting' ? strings.answerWaiting(label) : strings.answerSending(label)}</span>
        {phase === 'waiting' ? (
          <button type="button" className="wou-action-btn" onClick={() => controls.cancel(task)}>
            {strings.answerUndo}
          </button>
        ) : null}
      </div>
    )
  }

  if (!visible) return null

  const closeReply = () => {
    setReplyOpen(false)
    setReply('')
  }

  const sendReply = () => {
    if (!reply.trim()) return
    controls.answer(task, 'reply', reply)
    closeReply()
  }

  return (
    <div className="wou-answer" role="group" aria-label={strings.answerBarRegion}>
      <div className="wou-answer-bar">
        {canAnswer && yesNo ? (
          <>
            <button
              type="button"
              className="wou-action-btn wou-answer-yes"
              title={strings.answerYesTip}
              disabled={disabled}
              onClick={() => controls.answer(task, 'yes')}
            >
              {strings.answerYes}
            </button>
            <button
              type="button"
              className="wou-action-btn wou-answer-no"
              title={strings.answerNoTip}
              disabled={disabled}
              onClick={() => controls.answer(task, 'no')}
            >
              {strings.answerNo}
            </button>
          </>
        ) : null}
        {canAnswer ? (
          <button
            type="button"
            className="wou-action-btn"
            title={strings.answerReplyTip}
            aria-expanded={replyOpen}
            disabled={disabled}
            onClick={() => (replyOpen ? closeReply() : setReplyOpen(true))}
          >
            {strings.answerReply}
          </button>
        ) : null}
        {onDone ? (
          <button
            type="button"
            className="wou-action-btn"
            title={strings.answerDoneTip}
            disabled={disabled}
            onClick={onDone}
          >
            {strings.answerDone}
          </button>
        ) : null}
        <button
          type="button"
          className="wou-action-btn"
          title={strings.answerLaterTip}
          disabled={disabled}
          onClick={() => controls.later(task)}
        >
          {strings.answerLater}
        </button>
        <button
          type="button"
          className="wou-action-btn wou-answer-open"
          title={unsupportedNote ? `${strings.answerOpenTip}. ${unsupportedNote}` : strings.answerOpenTip}
          aria-describedby={unsupportedNote ? `wou-answer-unsupported-${task.id}` : undefined}
          onClick={() => controls.open(task)}
        >
          {openLabel}
          <IconExternalLink className="wou-external-link-icon" />
        </button>
      </div>
      {unsupportedNote ? (
        <p className="wou-answer-unsupported" id={`wou-answer-unsupported-${task.id}`} role="note">
          {unsupportedNote}
        </p>
      ) : null}
      {replyOpen && canAnswer ? (
        <form
          className="wou-answer-reply"
          onSubmit={e => {
            e.preventDefault()
            sendReply()
          }}
        >
          <textarea
            ref={replyRef}
            className="wou-answer-reply-input"
            aria-label={strings.answerReplyLabel}
            placeholder={strings.answerReplyPlaceholder}
            value={reply}
            maxLength={REPLY_MAX_CHARS}
            rows={2}
            disabled={disabled}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                closeReply()
                return
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                sendReply()
              }
            }}
          />
          <div className="wou-answer-reply-actions">
            <button type="submit" className="wou-action-btn wou-action-btn-primary" disabled={disabled || !reply.trim()}>
              {strings.answerReplySend}
            </button>
            <button type="button" className="wou-action-btn" onClick={closeReply}>
              {strings.answerReplyCancel}
            </button>
            <span className="wou-muted wou-answer-reply-hint">{strings.answerReplyHint}</span>
          </div>
        </form>
      ) : null}
    </div>
  )
}

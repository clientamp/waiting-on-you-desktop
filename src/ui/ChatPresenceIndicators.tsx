import type { Task } from '../model'
import { chatPresenceIndicators } from './chatPresence'
import { useHostPresenceContext } from './HostPresenceContext'
import { strings } from './strings'

const copy = {
  presenceWorking: strings.presenceWorking,
  presenceWorkingAria: strings.presenceWorkingAria,
  presenceResponded: strings.presenceResponded,
  presenceRespondedAria: strings.presenceRespondedAria,
  presenceRespondedUnavailable: strings.presenceRespondedUnavailable,
  presenceRespondedUnavailableAria: strings.presenceRespondedUnavailableAria,
  presenceReadUnavailable: strings.presenceReadUnavailable,
  presenceReadUnavailableAria: strings.presenceReadUnavailableAria,
}

export function ChatPresenceIndicators({
  task,
  showReadUnavailable = true,
}: {
  task: Pick<Task, 'chat_key' | 'chat_target' | 'status' | 'chat_title' | 'topic'>
  showReadUnavailable?: boolean
}) {
  const snapshot = useHostPresenceContext()
  const items = chatPresenceIndicators(task, snapshot, copy, { showReadUnavailable })
  if (items.length === 0) return null

  return (
    <span className="wou-chat-presence" role="group" aria-label={strings.presenceGroupAria}>
      {items.map(item => (
        <span
          key={item.kind}
          className={`wou-chat-presence-item wou-muted${item.kind === 'working' ? ' wou-chat-presence-working' : ''}${item.kind !== 'working' && 'available' in item && !item.available ? ' wou-chat-presence-na' : ''}`}
          role="status"
          aria-label={item.ariaLabel}
        >
          {item.label}
        </span>
      ))}
    </span>
  )
}

import { IconExternalLink } from './icons'
import { strings } from './strings'

export function OpenSessionLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="wou-link wou-chat-link wou-open-session-link" onClick={onClick}>
      {strings.openSession}
      <IconExternalLink className="wou-external-link-icon" />
    </button>
  )
}

export function AgentHandleLink({ agent, onClick }: { agent: string; onClick: () => void }) {
  return (
    <button type="button" className="wou-link wou-chat-link wou-open-session-link" onClick={onClick}>
      {strings.handleWithAgent(agent)}
      <IconExternalLink className="wou-external-link-icon" />
    </button>
  )
}

/** Ignore a project-scoped response that is no longer the one on screen. */

export interface ScopeToken {
  scope: string
  seq: number
}

export function acceptScopedPayload<T extends object>(
  requested: ScopeToken,
  current: ScopeToken,
  payload: T,
): T | null {
  if (requested.scope !== current.scope || requested.seq !== current.seq) return null
  const projectId = 'project_id' in payload ? payload.project_id : undefined
  if (typeof projectId === 'string' && projectId !== current.scope) return null
  return payload
}

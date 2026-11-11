export type TextKey = 'model' | 'base_url' | 'cloudflare_account_id'
export type DecisionDrafts = Record<TextKey, string>

/** Only acknowledge unchanged drafts sent by this request; never resurrect stale responses. */
export function mergeDecisionDrafts(
  current: DecisionDrafts, sent: DecisionDrafts, baseline: DecisionDrafts,
  patch: Partial<DecisionDrafts>, next: DecisionDrafts, sequence: number, latest: number,
): DecisionDrafts {
  if (sequence !== latest) return current
  const merged = { ...current }
  for (const key of ['model', 'base_url', 'cloudflare_account_id'] as const) {
    if (current[key] === sent[key] && (sent[key] === baseline[key] || key in patch)) merged[key] = next[key]
  }
  return merged
}

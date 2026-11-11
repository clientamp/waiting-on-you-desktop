/** Open the Kanban view without promising a board or card the page does not read. */

export function kanbanOpenPlan(cardId: string): {
  path: '/kanban'
  label: 'Open Kanban'
  cardId: string
} {
  return { path: '/kanban', label: 'Open Kanban', cardId: cardId.trim() }
}

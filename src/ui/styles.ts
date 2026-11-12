export const ROOT_CLASS = 'wou-root'

/** Minimal rules for the composer chrome trigger (dialog uses globalStyles). */
export const composerTriggerStyles = `
.${ROOT_CLASS} {
  --wou-fg: var(--dt-foreground, var(--foreground, #111));
  --wou-border: var(--dt-border, var(--border, #ddd));
  --wou-accent: var(--ui-accent, var(--accent, #2563eb));
  --wou-card: var(--dt-card, var(--card, #f8f8f8));
  color: var(--wou-fg);
  box-sizing: border-box;
}
.${ROOT_CLASS} *, .${ROOT_CLASS} *::before, .${ROOT_CLASS} *::after { box-sizing: inherit; }
.${ROOT_CLASS} .wou-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
  flex-shrink: 0;
  font: inherit;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-icon-btn svg {
  display: block;
  width: 16px;
  height: 16px;
}
.${ROOT_CLASS} .wou-composer-trigger { position: relative; }
/* The trigger is itself the .wou-root element, so it needs a compound rule.
   Desktop leaves only a 4px gap before the model pill, whose text has no left
   padding; add our own space so the icon doesn't crowd the model name. */
.${ROOT_CLASS}.wou-composer-trigger {
  position: relative;
  margin-inline-end: 8px;
}
.${ROOT_CLASS} .wou-composer-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wou-accent);
  pointer-events: none;
}
`

export const globalStyles = `
:root.dark .${ROOT_CLASS} { color-scheme: dark; }
.${ROOT_CLASS} {
  --wou-fg: var(--dt-foreground, var(--foreground, #111));
  --wou-muted: var(--dt-muted-foreground, var(--muted-foreground, #666));
  --wou-border: var(--dt-border, var(--border, #ddd));
  --wou-accent: var(--ui-accent, var(--accent, #2563eb));
  --wou-card: var(--dt-card, var(--card, #f8f8f8));
  color: var(--wou-fg);
  font: 13px/1.45 system-ui, sans-serif;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
}
.${ROOT_CLASS}.wou-dialog {
  height: auto;
  min-height: 0;
  width: min(440px, calc(100vw - 32px));
  max-height: min(80vh, 620px);
  overflow-y: auto;
}
.${ROOT_CLASS} *, .${ROOT_CLASS} *::before, .${ROOT_CLASS} *::after { box-sizing: inherit; }
.${ROOT_CLASS} button {
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  color: var(--wou-fg);
  border-radius: 6px;
  padding: 4px 10px;
}
.${ROOT_CLASS} button:disabled { opacity: 0.5; cursor: default; }
.${ROOT_CLASS} button.wou-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--wou-accent);
  text-align: left;
}
.${ROOT_CLASS} button.wou-icon {
  padding: 2px 6px;
  min-width: 28px;
}
.${ROOT_CLASS} input[type="checkbox"] { accent-color: var(--wou-accent); }
.${ROOT_CLASS} .wou-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-header-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow-x: hidden;
}
.${ROOT_CLASS} .wou-header-row2 {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-header-updated {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1 1 auto;
}
.${ROOT_CLASS} .wou-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}
.${ROOT_CLASS} .wou-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-icon-btn svg {
  display: block;
  width: 16px;
  height: 16px;
}
.${ROOT_CLASS} .wou-icon-spin {
  animation: wou-spin 0.8s linear infinite;
}
.${ROOT_CLASS} .wou-select {
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  font: inherit;
  font-size: 11px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 4px 4px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-clear-filters {
  flex-shrink: 0;
  font-size: 11px;
  white-space: nowrap;
  padding: 0 2px;
}
.${ROOT_CLASS} .wou-teach-wait { display: flex; align-items: flex-start; gap: 8px; }
.${ROOT_CLASS} .wou-teach-wait svg { width: 14px; height: 14px; flex-shrink: 0; margin-top: 3px; }
.${ROOT_CLASS} .wou-teach-prompt {
  position: relative;
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  background: var(--wou-card);
}
.${ROOT_CLASS} .wou-teach-prompt h2 { font-size: 13px; font-weight: 600; margin: 0 30px 6px 0; }
.${ROOT_CLASS} .wou-teach-prompt p { margin: 0 24px 10px 0; font-size: 12px; }
.${ROOT_CLASS} .wou-teach-prompt-actions { display: flex; align-items: center; gap: 14px; }
.${ROOT_CLASS} .wou-teach-prompt-close { position: absolute; top: 6px; right: 6px; border: none; background: none; color: var(--wou-muted); }
@media (prefers-reduced-motion: reduce) { .${ROOT_CLASS} .wou-teach-wait .wou-icon-spin { animation: none; } }
.${ROOT_CLASS} .wou-search-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-search-row-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-search-input {
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 5px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-search-include {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-search-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
}
.${ROOT_CLASS} .wou-search-filtered {
  font-size: 11px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.${ROOT_CLASS} .wou-search-empty {
  padding: 16px 0;
}
.${ROOT_CLASS} .wou-search-mark {
  background: var(--wou-search-highlight, var(--ui-selection-background, #fef08a));
  color: inherit;
  padding: 0;
}
.${ROOT_CLASS} .wou-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  flex-shrink: 0;
  white-space: nowrap;
}
.${ROOT_CLASS} .wou-muted { color: var(--wou-muted); font-size: 12px; }
.${ROOT_CLASS} .wou-section { margin-bottom: 16px; }
.${ROOT_CLASS} .wou-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--wou-border);
  position: relative;
}
.${ROOT_CLASS} .wou-row-follow-selected {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--wou-accent) 18%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 5%, var(--wou-card));
  padding-left: 8px;
  padding-right: 8px;
  margin: 2px 0;
}
.${ROOT_CLASS} .wou-group-follow-selected > .wou-group-parent {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--wou-accent) 18%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 5%, var(--wou-card));
  padding-left: 8px;
  padding-right: 8px;
  margin: 2px 0;
}
.${ROOT_CLASS} .wou-row-nested {
  padding: 6px 0;
  border-bottom: none;
}
.${ROOT_CLASS} .wou-row-nested input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-row-nested .wou-topic {
  font-weight: 400;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${ROOT_CLASS} .wou-row-nested .wou-ask {
  font-size: 13px;
  margin-top: 1px;
}
.${ROOT_CLASS} .wou-row-nested .wou-ask-only {
  margin-top: 0;
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-icon-nested {
  min-width: 24px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  opacity: 0;
  line-height: 1;
}
.${ROOT_CLASS} .wou-row-nested:hover .wou-icon-nested,
.${ROOT_CLASS} .wou-row-nested:focus-within .wou-icon-nested,
.${ROOT_CLASS} .wou-row-nested.wou-row-menu-open .wou-icon-nested {
  opacity: 1;
}
@media (hover: none) {
  .${ROOT_CLASS} .wou-icon-nested {
    opacity: 1;
  }
}
.${ROOT_CLASS} .wou-group {
  /* Groups sit in the list like any other card: same divider, no box. */
  border-bottom: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-group .wou-row {
  border-bottom: none;
}
.${ROOT_CLASS} .wou-group-parent {
  /* Left 9px + 16px chevron + 8px gap = the 33px left column single rows use. */
  padding: 8px 11px 8px 9px;
}
.${ROOT_CLASS} .wou-group-children {
  margin: 0 10px 8px calc(8px + 22px + 8px + 14px + 28px);
  padding-left: 10px;
  border-left: 2px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-group-collapsed-preview {
  /* Same as a single card's ask line: muted, wraps. */
  margin: 2px 0 0;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-group-chevron-btn {
  border: none;
  background: none;
  padding: 2px 4px 0 0;
  color: var(--wou-muted);
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-group-checkbox-spacer {
  width: 13px;
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-group-title-line {
  display: block;
  min-width: 0;
}
.${ROOT_CLASS} .wou-group-title {
  display: inline;
  font-weight: 600;
}
.${ROOT_CLASS} .wou-card-title-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-card-title-main {
  flex: 1;
  min-width: 0;
}
.${ROOT_CLASS} .wou-updated-at {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11px;
}
.${ROOT_CLASS} .wou-chat-presence {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.${ROOT_CLASS} .wou-chat-presence-working {
  color: var(--dt-accent, var(--wou-accent));
}
.${ROOT_CLASS} .wou-chat-presence-na {
  font-style: italic;
}
.${ROOT_CLASS} .wou-open-session-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.${ROOT_CLASS} .wou-external-link-icon {
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-group-count-pill {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 6px;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 400;
  color: var(--wou-muted);
  background: color-mix(in srgb, var(--wou-card) 70%, var(--dt-muted, var(--wou-border)) 30%);
  border: 1px solid var(--wou-border);
  border-radius: 999px;
  padding: 1px 8px;
  line-height: 1.35;
  flex-shrink: 0;
}
@supports (background: color-mix(in srgb, white 50%, black)) {
  .${ROOT_CLASS} .wou-group-count-pill {
    background: color-mix(in srgb, var(--wou-card) 70%, var(--dt-muted, var(--wou-border)) 30%);
  }
}
.${ROOT_CLASS} .wou-group-confirm {
  margin-top: 8px;
  padding: 10px 12px 14px;
  font-size: 12px;
  border: 1.5px solid color-mix(in srgb, var(--wou-accent) 70%, var(--wou-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--wou-accent) 9%, var(--wou-card));
}
.${ROOT_CLASS} .wou-group-confirm-q {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 13px;
}
.${ROOT_CLASS} .wou-group-confirm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.${ROOT_CLASS} .wou-group-confirm-yes {
  background: var(--wou-accent);
  border-color: var(--wou-accent);
  color: var(--dt-primary-solid-foreground, #fcfcfc);
  font-weight: 600;
}
.${ROOT_CLASS} .wou-group-confirm-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding: 6px 6px 6px 10px;
  font-size: 11px;
  color: var(--wou-muted);
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
}
.${ROOT_CLASS} .wou-group-confirm-hint span { flex: 1; min-width: 0; padding-top: 1px; }
.${ROOT_CLASS} button.wou-tip-dismiss {
  flex: none;
  border: none;
  background: none;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
  color: var(--wou-muted);
}
.${ROOT_CLASS} button.wou-tip-dismiss:hover { color: var(--wou-fg); }
.${ROOT_CLASS} .wou-row-body { flex: 1; min-width: 0; }
.${ROOT_CLASS} .wou-topic { font-weight: 600; display: block; }
.${ROOT_CLASS} .wou-ask { color: var(--wou-muted); margin-top: 2px; }
.${ROOT_CLASS} .wou-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
}
.${ROOT_CLASS} .wou-badge {
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
}
.${ROOT_CLASS} {
  --wou-menu-hover: rgba(55, 53, 47, 0.08);
  --wou-menu-shadow-ring: rgba(15, 15, 15, 0.05);
  --wou-menu-shadow-mid: rgba(15, 15, 15, 0.1);
  --wou-menu-shadow-far: rgba(15, 15, 15, 0.2);
  --wou-menu-danger: #e03e3e;
  --wou-menu-danger-hover: rgba(224, 62, 62, 0.08);
}
:root.dark .${ROOT_CLASS} {
  --wou-menu-hover: rgba(255, 255, 255, 0.055);
  --wou-menu-shadow-ring: rgba(15, 15, 15, 0.2);
  --wou-menu-shadow-mid: rgba(15, 15, 15, 0.35);
  --wou-menu-shadow-far: rgba(15, 15, 15, 0.5);
  --wou-menu-danger: #ff7369;
  --wou-menu-danger-hover: rgba(255, 115, 105, 0.08);
}
.${ROOT_CLASS} .wou-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 10;
  min-width: 232px;
  max-width: min(280px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--wou-fg) 16%, transparent);
}
.${ROOT_CLASS} .wou-menu-notion {
  width: 240px;
  min-width: 240px;
  max-width: 240px;
  padding: 6px;
  box-shadow:
    0 0 0 1px var(--wou-menu-shadow-ring),
    0 3px 6px var(--wou-menu-shadow-mid),
    0 9px 24px var(--wou-menu-shadow-far);
}
.${ROOT_CLASS} .wou-menu-floating {
  position: fixed;
  right: auto;
  bottom: auto;
  z-index: 1000;
  max-height: none;
}
.${ROOT_CLASS} .wou-menu button.wou-menu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  padding: 0 8px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wou-fg);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-menu button.wou-menu-row:hover,
.${ROOT_CLASS} .wou-menu button.wou-menu-row:focus-visible {
  background: var(--wou-menu-hover);
  outline: none;
}
.${ROOT_CLASS} .wou-menu-row-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-menu-row-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}
.${ROOT_CLASS} .wou-menu-row-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${ROOT_CLASS} .wou-menu-row-trail {
  flex-shrink: 0;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-menu-row-trail svg {
  width: 16px;
  height: 16px;
  display: block;
}
.${ROOT_CLASS} .wou-menu-row-danger,
.${ROOT_CLASS} .wou-menu-row-danger .wou-menu-row-icon {
  color: var(--wou-menu-danger);
}
.${ROOT_CLASS} .wou-menu-row-danger:hover,
.${ROOT_CLASS} .wou-menu-row-danger:focus-visible {
  background: var(--wou-menu-danger-hover);
}
.${ROOT_CLASS} .wou-menu-priority-sq,
.${ROOT_CLASS} .wou-menu-priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  display: block;
}
.${ROOT_CLASS} .wou-quadrant-dot-1 { background: var(--dt-destructive, #e03e3e); }
.${ROOT_CLASS} .wou-quadrant-dot-2 { background: var(--wou-accent); }
.${ROOT_CLASS} .wou-quadrant-dot-3 {
  background: color-mix(in srgb, #f59e0b 85%, var(--wou-fg));
}
.${ROOT_CLASS} .wou-quadrant-dot-4 { background: var(--wou-muted); }
.${ROOT_CLASS} .wou-menu-section {
  font-size: 11px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  color: var(--wou-muted);
  padding: 6px 8px 4px;
  user-select: none;
}
.${ROOT_CLASS} .wou-menu-empty-line {
  margin: 0;
  padding: 0 8px 4px;
  font-size: 12px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-menu-tag-list-scroll {
  max-height: calc(6 * 28px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}
/* Always-visible scroll bar (macOS hides overlay bars until hover). */
.${ROOT_CLASS} .wou-menu-tag-list-scroll::-webkit-scrollbar { width: 8px; }
.${ROOT_CLASS} .wou-menu-tag-list-scroll::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--wou-border) 45%, transparent);
  border-radius: 4px;
}
.${ROOT_CLASS} .wou-menu-tag-list-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--wou-muted) 55%, transparent);
  border-radius: 4px;
  min-height: 24px;
}
.${ROOT_CLASS} .wou-menu-tag-list-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--wou-muted);
}
.${ROOT_CLASS} .wou-menu-sep {
  height: 1px;
  background: var(--wou-border);
  margin: 4px 0;
}
.${ROOT_CLASS} .wou-shortcuts-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.${ROOT_CLASS} .wou-shortcuts-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 12px;
  border-top: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-shortcuts-row:first-child {
  border-top: none;
  padding-top: 0;
}
.${ROOT_CLASS} .wou-shortcuts-label {
  flex: 1 1 auto;
  min-width: 0;
}
.${ROOT_CLASS} .wou-shortcuts-keys {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.${ROOT_CLASS} .wou-keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  padding: 2px 6px;
  border: 1px solid var(--wou-border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--wou-card) 92%, var(--wou-muted) 8%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.2;
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-shortcuts-hint {
  font-size: 11px;
  color: var(--wou-muted);
  white-space: nowrap;
}
.${ROOT_CLASS} .wou-shortcuts-footer {
  margin: 10px 0 0;
  font-size: 11px;
}
.${ROOT_CLASS} .wou-inline-rename {
  width: 100%;
  margin-bottom: 4px;
}
.${ROOT_CLASS} .wou-inline-rename-input {
  display: block;
  width: 100%;
  font: inherit;
  font-weight: 600;
  font-size: inherit;
  line-height: inherit;
  padding: 2px 4px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wou-fg);
  outline: none;
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--wou-accent) 55%, transparent);
}
.${ROOT_CLASS} .wou-inline-rename-input::placeholder {
  color: var(--wou-fg);
  opacity: 0.45;
}
.${ROOT_CLASS} .wou-inline-rename-input:focus {
  box-shadow: inset 0 -2px 0 var(--wou-accent);
}
.${ROOT_CLASS} .wou-group-title.wou-inline-rename-input {
  font-size: 15px;
}
.${ROOT_CLASS} .wou-inline-rename-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.${ROOT_CLASS} .wou-inline-rename-save {
  border-color: var(--wou-accent);
  background: color-mix(in srgb, var(--wou-accent) 12%, var(--wou-card));
  color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-inline-rename-ai {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.${ROOT_CLASS} .wou-inline-rename-ai svg {
  flex-shrink: 0;
  color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-inline-rename-ai[aria-busy='true'] svg {
  animation: wou-ai-pulse 1s ease-in-out infinite;
}
@keyframes wou-ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.${ROOT_CLASS} .wou-inline-rename-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-menu-kbd {
  font: inherit;
  font-size: 11px;
  color: var(--wou-muted);
  opacity: 0.8;
}
.${ROOT_CLASS} .wou-inline-rename-hint {
  font-size: 11px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-undo {
  position: sticky;
  bottom: 0;
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.${ROOT_CLASS} .wou-page,
.${ROOT_CLASS} .wou-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}
.${ROOT_CLASS} .wou-page { padding: 16px; max-width: 720px; margin: 0 auto; width: 100%; }
.${ROOT_CLASS} .wou-pane { padding: 12px; }
.${ROOT_CLASS} .wou-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  margin-top: 8px;
}
.${ROOT_CLASS} .wou-project-filter-wrap {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}
.${ROOT_CLASS} .wou-project-filter-btn {
  display: block;
  width: 100%;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}
.${ROOT_CLASS} .wou-project-filter-btn-label {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${ROOT_CLASS} .wou-project-filter-menu {
  position: fixed;
  z-index: 1000;
  right: auto;
  max-height: min(320px, 60vh);
  overflow-x: hidden;
  overflow-y: auto;
  box-shadow: 0 6px 24px color-mix(in srgb, var(--wou-fg) 18%, transparent);
}
.${ROOT_CLASS} .wou-project-filter-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}
.${ROOT_CLASS} .wou-project-filter-row span {
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 0;
  flex: 1 1 auto;
}
.${ROOT_CLASS} .wou-project-filter-row:hover {
  background: var(--wou-border);
}
.${ROOT_CLASS} .wou-project-chip {
  font-style: normal;
  background: color-mix(in srgb, var(--wou-accent) 12%, var(--wou-card));
  border-color: color-mix(in srgb, var(--wou-accent) 30%, var(--wou-border));
}
.${ROOT_CLASS} .wou-submenu-wrap { position: relative; }
.${ROOT_CLASS} .wou-submenu {
  margin-left: 8px;
  border-left: 2px solid var(--wou-border);
  padding-left: 4px;
}
.${ROOT_CLASS} .wou-agent-chip {
  color: var(--wou-muted);
  font-size: 11px;
  border: 1px solid var(--wou-border);
  border-radius: 4px;
  padding: 0 5px;
  white-space: nowrap;
}
.${ROOT_CLASS} .wou-chat-link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.${ROOT_CLASS} .wou-section-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  padding: 8px 0 6px;
  color: var(--wou-muted);
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--dt-background, var(--wou-card));
}
.${ROOT_CLASS} .wou-section-heading:hover { color: var(--wou-fg); }
.${ROOT_CLASS} .wou-chevron {
  display: inline-block;
  transition: transform 0.15s ease;
  font-size: 10px;
}
.${ROOT_CLASS} .wou-chevron-collapsed { transform: rotate(-90deg); }
.${ROOT_CLASS} .wou-show-all {
  margin: 4px 0 8px;
}
.${ROOT_CLASS} .wou-settings-wrap { position: relative; }
.${ROOT_CLASS} .wou-settings-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 260px;
  max-width: 320px;
  padding: 10px 12px;
  background: var(--wou-card);
  border: 1px solid var(--wou-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.${ROOT_CLASS} .wou-settings-popover label {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--wou-border); }
.${ROOT_CLASS} .wou-closed-row { opacity: 0.85; }
.${ROOT_CLASS} .wou-row-pending {
  opacity: 0.55;
}
.${ROOT_CLASS} .wou-row-pending .wou-topic,
.${ROOT_CLASS} .wou-row-pending .wou-ask {
  text-decoration: line-through;
}
.${ROOT_CLASS} .wou-pending-label {
  font-size: 12px;
  color: var(--wou-muted);
  margin-top: 4px;
  font-style: italic;
}
@keyframes wou-spin {
  to { transform: rotate(360deg); }
}
.${ROOT_CLASS} .wou-snooze-form {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.${ROOT_CLASS} .wou-snooze-form-label {
  display: block;
  margin-bottom: 4px;
}
.${ROOT_CLASS} .wou-snooze-form input[type="datetime-local"] {
  font: inherit;
  color: var(--wou-fg);
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--wou-card);
}
.${ROOT_CLASS} .wou-snooze-error {
  margin: 0;
  font-size: 12px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-snooze-actions {
  display: flex;
  gap: 8px;
}
.${ROOT_CLASS} .wou-header-status {
  font-size: 11px;
  white-space: nowrap;
}
.${ROOT_CLASS} .wou-scan-banner {
  font-size: 12px;
  padding: 6px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.${ROOT_CLASS} .wou-scan-banner-warn {
  color: var(--dt-destructive, #c2410c);
}
:root.dark .${ROOT_CLASS} .wou-scan-banner-warn {
  color: var(--dt-destructive, #fb923c);
}
.${ROOT_CLASS} .wou-first-run {
  padding: 24px 8px;
  max-width: 420px;
}
.${ROOT_CLASS} .wou-first-run-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px;
}
.${ROOT_CLASS} .wou-first-run p {
  margin: 0 0 10px;
  line-height: 1.5;
}
.${ROOT_CLASS} .wou-first-run-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  align-items: flex-start;
}
.${ROOT_CLASS} .wou-list-empty {
  padding: 32px 8px;
  text-align: center;
}
.${ROOT_CLASS} .wou-list-empty p {
  margin: 0 0 8px;
}
.${ROOT_CLASS} .wou-settings-view {
  padding-bottom: 16px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-settings-view-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.${ROOT_CLASS} .wou-settings-back {
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-settings-view-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.${ROOT_CLASS} .wou-settings-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-settings-card {
  border: 1px solid var(--wou-border);
  border-radius: 10px;
  padding: 12px 14px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-settings-card h3 {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-settings-section {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-settings-section h3 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--wou-muted);
  margin: 0 0 10px;
}
.${ROOT_CLASS} .wou-settings-toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--wou-border);
  min-width: 0;
}
.${ROOT_CLASS} .wou-settings-card > .wou-settings-toggle-row:first-of-type {
  border-top: none;
  padding-top: 0;
}
.${ROOT_CLASS} .wou-settings-toggle-label {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-settings-row-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}
.${ROOT_CLASS} .wou-settings-row-desc {
  display: block;
  font-size: 11px;
  line-height: 1.35;
  margin-top: 4px;
}
.${ROOT_CLASS} .wou-switch {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  padding: 2px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.${ROOT_CLASS} .wou-switch-on {
  background: var(--ui-accent, var(--wou-accent));
  border-color: var(--ui-accent, var(--wou-accent));
}
.${ROOT_CLASS} .wou-switch-knob {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wou-fg);
  transition: transform 0.15s ease;
}
.${ROOT_CLASS} .wou-switch-on .wou-switch-knob {
  transform: translateX(18px);
  background: var(--wou-card);
}
.${ROOT_CLASS} .wou-mode-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.${ROOT_CLASS} .wou-mode-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-mode-card-selected {
  border-color: var(--ui-accent, var(--wou-accent));
  box-shadow: inset 0 0 0 1px var(--ui-accent, var(--wou-accent));
}
.${ROOT_CLASS} .wou-mode-card-title {
  font-size: 12px;
  font-weight: 600;
}
.${ROOT_CLASS} .wou-mode-card-desc {
  font-size: 11px;
  line-height: 1.35;
}
.${ROOT_CLASS} .wou-settings-usage-line {
  margin: 0 0 8px;
  font-size: 12px;
}
.${ROOT_CLASS} .wou-usage-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--wou-border);
  overflow: hidden;
  margin-bottom: 10px;
}
.${ROOT_CLASS} .wou-usage-bar-fill {
  height: 100%;
  background: var(--ui-accent, var(--wou-accent));
  border-radius: 3px;
}
.${ROOT_CLASS} .wou-usage-bars {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: space-between;
}
.${ROOT_CLASS} .wou-usage-bars li {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.${ROOT_CLASS} .wou-usage-bar-mini {
  width: 100%;
  max-width: 28px;
  height: 36px;
  border-radius: 3px;
  background: var(--wou-border);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.${ROOT_CLASS} .wou-usage-bar-mini-fill {
  width: 100%;
  background: var(--ui-accent, var(--wou-accent));
  border-radius: 3px 3px 0 0;
  min-height: 2px;
}
.${ROOT_CLASS} .wou-usage-bar-day {
  font-size: 9px;
}
.${ROOT_CLASS} .wou-settings-model-line {
  margin: 0;
  font-size: 11px;
}
.${ROOT_CLASS} .wou-settings-advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--wou-fg);
  cursor: pointer;
  text-align: left;
}
.${ROOT_CLASS} .wou-settings-advanced-chevron {
  width: 12px;
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-settings-advanced-body {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-btn-compact {
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  color: var(--wou-fg);
  cursor: pointer;
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-link-compact {
  font-size: 11px;
}
.${ROOT_CLASS} .wou-settings-empty {
  margin: 0;
  font-size: 12px;
}

.${ROOT_CLASS} .wou-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 12px;
}
.${ROOT_CLASS} .wou-field-label {
  font-weight: 500;
}
.${ROOT_CLASS} .wou-field input[type="number"],
.${ROOT_CLASS} .wou-field select {
  font: inherit;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
  max-width: 160px;
}
.${ROOT_CLASS} .wou-field-readonly {
  margin: 0;
  font-weight: 500;
}
.${ROOT_CLASS} .wou-field-error {
  color: var(--wou-muted);
  font-size: 11px;
}
.${ROOT_CLASS} .wou-settings-check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 10px;
}
.${ROOT_CLASS} .wou-usage-history {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  font-size: 11px;
}
.${ROOT_CLASS} .wou-usage-history li {
  padding: 2px 0;
}
.${ROOT_CLASS} .wou-source-excerpt {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-left: 3px solid var(--wou-border);
  color: var(--wou-muted);
  font-size: 12px;
  white-space: pre-wrap;
  font-style: italic;
  max-height: calc(1.45em * 15);
  overflow-y: auto;
}
.${ROOT_CLASS} .wou-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.${ROOT_CLASS} .wou-action-btn {
  font-size: 11px;
  padding: 2px 8px;
  line-height: 1.35;
}
.${ROOT_CLASS} .wou-action-btn-primary {
  background: var(--wou-accent);
  color: var(--dt-primary-foreground, #fff);
  border-color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-action-btn-danger {
  border-color: var(--dt-destructive, #dc2626);
  color: var(--dt-destructive, #dc2626);
  background: transparent;
}
.${ROOT_CLASS} .wou-action-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
}
.${ROOT_CLASS} .wou-action-confirm-text {
  flex: 1 1 100%;
  color: var(--wou-muted);
}

/* Alignment pass: each checkbox is centered on the first line of its title. */
.${ROOT_CLASS} .wou-row > input[type="checkbox"] {
  width: 16px; height: 16px; margin: 2px 0 0 0; flex-shrink: 0;
}
.${ROOT_CLASS} .wou-topic { line-height: 20px; }
.${ROOT_CLASS} .wou-group-parent > input[type="checkbox"],
.${ROOT_CLASS} .wou-group-parent > .wou-group-checkbox-spacer { margin-top: 2px; width: 16px; height: 16px; }
.${ROOT_CLASS} .wou-group-title-line { align-items: center; min-height: 20px; }
.${ROOT_CLASS} .wou-group-title { line-height: 20px; }
.${ROOT_CLASS} .wou-group-chevron-btn {
  width: 16px; height: 20px; padding: 0; display: inline-flex;
  align-items: center; justify-content: center;
}
.${ROOT_CLASS} .wou-row-nested > input[type="checkbox"] { width: 14px; height: 14px; margin: 2px 0 0 0; }
.${ROOT_CLASS} .wou-row-nested .wou-topic { line-height: 18px; }
.${ROOT_CLASS} .wou-row-nested .wou-ask-only { line-height: 18px; }
/* Same left column for single rows and group rows: card border + padding + chevron + gap. */
.${ROOT_CLASS} .wou-section > .wou-row:not(.wou-row-nested) { padding-left: 33px; padding-right: 11px; }
/* Children: guide line under the parent checkbox, child checkbox under the parent title. */
.${ROOT_CLASS} .wou-group-children { margin: 0 10px 8px 40px; padding-left: 15px; }

.${ROOT_CLASS}.wou-dialog {
  font: 13px/1.45 system-ui, sans-serif;
  color: var(--wou-fg);
  box-sizing: border-box;
}
.${ROOT_CLASS} .wou-composer-trigger {
  position: relative;
}
.${ROOT_CLASS} .wou-composer-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wou-accent);
  pointer-events: none;
}
.${ROOT_CLASS} .wou-composer-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
.${ROOT_CLASS} .wou-composer-body .wou-field {
  margin-bottom: 0;
  gap: 6px;
}
.${ROOT_CLASS} .wou-composer-body .wou-field-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-field-hint {
  font-size: 11px;
  line-height: 1.35;
}
.${ROOT_CLASS} .wou-composer-body .wou-field select.wou-select {
  max-width: 100%;
  width: 100%;
}
.${ROOT_CLASS} .wou-composer-task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.${ROOT_CLASS} .wou-composer-task-item {
  padding: 8px 10px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  font-size: 12px;
}
.${ROOT_CLASS} .wou-composer-task-primary {
  font-weight: 500;
  margin: 0 0 4px;
}
.${ROOT_CLASS} .wou-composer-task-meta {
  margin: 0;
  font-size: 11px;
  color: var(--wou-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.${ROOT_CLASS} .wou-composer-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--wou-border);
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-quadrant-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.${ROOT_CLASS} .wou-quadrant-option {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 11px;
  line-height: 1.3;
  cursor: pointer;
  padding: 8px 6px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  position: relative;
}
.${ROOT_CLASS} .wou-quadrant-option:has(input:checked) {
  border-color: var(--wou-accent);
  background: color-mix(in srgb, var(--wou-accent) 12%, var(--wou-card));
  color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-quadrant-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  margin: 0;
}
.${ROOT_CLASS} .wou-composer-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-composer-error-footer {
  justify-content: flex-end;
}
.${ROOT_CLASS} .wou-composer-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.${ROOT_CLASS} .wou-field input[type="text"],
.${ROOT_CLASS} .wou-field textarea {
  font: inherit;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--wou-card);
  color: var(--wou-fg);
  max-width: 100%;
  width: 100%;
}
.${ROOT_CLASS} .wou-field textarea {
  resize: vertical;
  min-height: 56px;
}
/* Tag colors: one hue per allowed color, mixed with the theme so text stays readable. */
.${ROOT_CLASS} {
  --wou-tag-gray: #8a8f98;
  --wou-tag-red: #e5484d;
  --wou-tag-orange: #f76b15;
  --wou-tag-yellow: #e2a336;
  --wou-tag-green: #30a46c;
  --wou-tag-teal: #12a594;
  --wou-tag-blue: #0090ff;
  --wou-tag-purple: #8e4ec6;
  --wou-tag-pink: #d6409f;
  --wou-tag-hue: var(--wou-tag-gray);
}
:root.dark .${ROOT_CLASS} {
  --wou-tag-gray: #9ba1a6;
  --wou-tag-red: #ff6369;
  --wou-tag-orange: #ff8b3e;
  --wou-tag-yellow: #f5c451;
  --wou-tag-green: #3dd68c;
  --wou-tag-teal: #0bd8b6;
  --wou-tag-blue: #52a9ff;
  --wou-tag-purple: #bf7af0;
  --wou-tag-pink: #f76fb8;
}
.${ROOT_CLASS} .wou-tc-gray { --wou-tag-hue: var(--wou-tag-gray); }
.${ROOT_CLASS} .wou-tc-red { --wou-tag-hue: var(--wou-tag-red); }
.${ROOT_CLASS} .wou-tc-orange { --wou-tag-hue: var(--wou-tag-orange); }
.${ROOT_CLASS} .wou-tc-yellow { --wou-tag-hue: var(--wou-tag-yellow); }
.${ROOT_CLASS} .wou-tc-green { --wou-tag-hue: var(--wou-tag-green); }
.${ROOT_CLASS} .wou-tc-teal { --wou-tag-hue: var(--wou-tag-teal); }
.${ROOT_CLASS} .wou-tc-blue { --wou-tag-hue: var(--wou-tag-blue); }
.${ROOT_CLASS} .wou-tc-purple { --wou-tag-hue: var(--wou-tag-purple); }
.${ROOT_CLASS} .wou-tc-pink { --wou-tag-hue: var(--wou-tag-pink); }
.${ROOT_CLASS} .wou-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 140px;
  padding: 0 7px;
  height: 18px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--wou-tag-hue) 62%, var(--wou-fg));
  background: color-mix(in srgb, var(--wou-tag-hue) 14%, var(--wou-card));
  border: 1px solid color-mix(in srgb, var(--wou-tag-hue) 32%, var(--wou-border));
}
.${ROOT_CLASS} .wou-tag-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.${ROOT_CLASS} .wou-tag-chip svg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-tag-chip-more {
  color: var(--wou-muted);
  background: var(--wou-card);
  border-color: var(--wou-border);
}
.${ROOT_CLASS} .wou-tag-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--wou-tag-hue);
}
.${ROOT_CLASS} button.wou-project-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--wou-fg);
  cursor: pointer;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  font-size: 11px;
}
.${ROOT_CLASS} button.wou-project-chip:hover {
  border-color: color-mix(in srgb, var(--wou-accent) 55%, var(--wou-border));
}
.${ROOT_CLASS} .wou-project-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--wou-tag-hue);
}
.${ROOT_CLASS} .wou-task-context {
  margin-top: 2px;
  font-size: 12px;
  color: var(--wou-muted);
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${ROOT_CLASS} .wou-due-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  color: var(--wou-muted);
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
}
.${ROOT_CLASS} .wou-due-overdue,
.${ROOT_CLASS} .wou-due-today {
  color: color-mix(in srgb, var(--wou-tag-red) 75%, var(--wou-fg));
  background: color-mix(in srgb, var(--wou-tag-red) 12%, var(--wou-card));
  border-color: color-mix(in srgb, var(--wou-tag-red) 35%, var(--wou-border));
}
.${ROOT_CLASS} .wou-due-overdue { font-weight: 600; }
.${ROOT_CLASS} .wou-nested-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}
.${ROOT_CLASS} .wou-menu-tag-check {
  display: inline-block;
  width: 16px;
  text-align: center;
  color: var(--wou-fg);
  font-weight: 600;
}
.${ROOT_CLASS} .wou-filter-menu-heading {
  padding: 6px 8px 2px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-filter-menu-hint {
  margin: 0;
  padding: 4px 8px 6px;
  font-size: 11px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-filter-menu-count {
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.${ROOT_CLASS} button.wou-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  border: 2px solid transparent;
  background: var(--wou-tag-hue);
  cursor: pointer;
  box-shadow: inset 0 0 0 2px var(--wou-card);
}
.${ROOT_CLASS} button.wou-swatch[aria-checked="true"] {
  border-color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-settings-select-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--wou-border);
  min-width: 0;
}
.${ROOT_CLASS} .wou-settings-card > .wou-settings-select-row:first-of-type {
  border-top: none;
  padding-top: 0;
}
.${ROOT_CLASS} .wou-settings-select-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.${ROOT_CLASS} .wou-segmented {
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  overflow: hidden;
}
.${ROOT_CLASS} .wou-segmented button {
  border: none;
  border-radius: 0;
  padding: 4px 9px;
  font-size: 12px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-segmented button + button {
  border-left: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-segmented button[aria-checked="true"] {
  background: color-mix(in srgb, var(--wou-accent) 18%, var(--wou-card));
  font-weight: 600;
}
.${ROOT_CLASS} .wou-tag-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
}
.${ROOT_CLASS} .wou-tag-list-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid var(--wou-border);
  font-size: 12px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-tag-list-item:first-child { border-top: none; }
.${ROOT_CLASS} .wou-tag-list-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.${ROOT_CLASS} button.wou-tag-swatch-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--wou-tag-hue) 50%, var(--wou-border));
  background: var(--wou-tag-hue);
  flex-shrink: 0;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-tag-list input[type="text"] {
  font: inherit;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 3px 6px;
  background: transparent;
  color: var(--wou-fg);
  min-width: 0;
}
.${ROOT_CLASS} .wou-tag-list input[type="text"]:hover,
.${ROOT_CLASS} .wou-tag-list input[type="text"]:focus {
  border-color: var(--wou-border);
  background: var(--wou-card);
  outline: none;
}
.${ROOT_CLASS} .wou-tag-name-input { flex: 1 1 auto; font-weight: 600; }
.${ROOT_CLASS} .wou-tag-open-count { font-size: 11px; flex-shrink: 0; }
.${ROOT_CLASS} .wou-tag-hint-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 24px;
}
.${ROOT_CLASS} .wou-tag-hint-row input[type="text"] { width: 100%; }
.${ROOT_CLASS} .wou-tag-hint-label { font-size: 11px; }
.${ROOT_CLASS} .wou-tag-list .wou-swatches { padding-left: 24px; }
/* Teach priorities */
.${ROOT_CLASS} .wou-teach { outline: none; }
.${ROOT_CLASS} .wou-teach-progress { margin-left: auto; font-size: 12px; }
.${ROOT_CLASS} .wou-teach-card {
  border: 1px solid var(--wou-border);
  border-radius: 10px;
  padding: 14px;
}
.${ROOT_CLASS} .wou-teach-intro { margin: 0 0 10px; font-size: 12px; }
.${ROOT_CLASS} .wou-teach-ask {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.${ROOT_CLASS} .wou-teach-context {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.${ROOT_CLASS} .wou-teach-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin: 0 0 4px;
}
.${ROOT_CLASS} .wou-teach-filed { font-size: 12px; margin: 0 0 12px; }
.${ROOT_CLASS} .wou-teach-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.${ROOT_CLASS} .wou-teach-choice {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  row-gap: 2px;
  align-items: center;
  text-align: left;
  min-height: 64px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--wou-border);
  background: var(--wou-card);
  color: var(--wou-fg);
  font: inherit;
  cursor: pointer;
}
.${ROOT_CLASS} .wou-teach-choice:hover:not(:disabled),
.${ROOT_CLASS} .wou-teach-choice:focus-visible {
  border-color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-teach-choice:disabled { opacity: 0.6; cursor: default; }
.${ROOT_CLASS} .wou-teach-choice .wou-keycap { grid-row: 1 / span 2; }
.${ROOT_CLASS} .wou-teach-choice-label { font-size: 13px; font-weight: 600; line-height: 1.3; }
.${ROOT_CLASS} .wou-teach-choice-hint { font-size: 11px; }
.${ROOT_CLASS} .wou-teach-choice-current {
  border-style: dashed;
}
.${ROOT_CLASS} .wou-teach-error { font-size: 12px; margin: 10px 0 0; }
.${ROOT_CLASS} .wou-teach-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.${ROOT_CLASS} .wou-teach-keys { font-size: 11px; margin-left: auto; }
.${ROOT_CLASS} .wou-teach-end { padding: 16px 4px; }
.${ROOT_CLASS} .wou-teach-end p { margin: 0 0 10px; line-height: 1.5; }
.${ROOT_CLASS} .wou-teach-end-actions { display: flex; gap: 8px; flex-wrap: wrap; }
/* What matters to you */
.${ROOT_CLASS} .wou-char-count { font-size: 11px; color: var(--wou-muted); align-self: flex-end; }
.${ROOT_CLASS} .wou-char-count-over { color: var(--dt-destructive, #c2410c); }
.${ROOT_CLASS} .wou-settings-inline-action {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
/* Decision model */
.${ROOT_CLASS} .wou-decision-intro { margin-bottom: 10px; line-height: 1.45; }
.${ROOT_CLASS} .wou-decision { margin-bottom: 4px; }
.${ROOT_CLASS} .wou-decision .wou-field select { max-width: 100%; }
.${ROOT_CLASS} .wou-decision-native { font-size: 12px; margin: 0 0 10px; }
.${ROOT_CLASS} .wou-decision-key { font-size: 12px; margin: 0 0 10px; }
.${ROOT_CLASS} .wou-decision-key-ok,
.${ROOT_CLASS} .wou-decision-key-missing { font-weight: 500; }
.${ROOT_CLASS} .wou-decision-test {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 12px;
}
.${ROOT_CLASS} .wou-decision-test-fail { color: var(--dt-destructive, #c2410c); }
.${ROOT_CLASS} .wou-decision-usage { font-size: 11px; margin: 0 0 6px; }
/* Tag suggestions */
.${ROOT_CLASS} .wou-suggest {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--wou-border);
}
.${ROOT_CLASS} .wou-suggest-head { display: flex; gap: 8px; flex-wrap: wrap; }
.${ROOT_CLASS} .wou-suggest-note { font-size: 11px; margin: 6px 0; }
.${ROOT_CLASS} .wou-suggest-error { font-size: 12px; margin: 6px 0; }
.${ROOT_CLASS} .wou-suggest-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.${ROOT_CLASS} .wou-suggest-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.${ROOT_CLASS} .wou-suggest-main .wou-tag-swatch-btn {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--wou-tag-hue) 50%, var(--wou-border));
  background: var(--wou-tag-hue);
  flex-shrink: 0;
}
.${ROOT_CLASS} .wou-suggest-main input[type="text"] {
  font: inherit;
  font-size: 12px;
  min-width: 0;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  padding: 3px 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-suggest-hint { font-size: 11px; margin: 2px 0 0 24px; }
.${ROOT_CLASS} .wou-suggest-added { font-size: 11px; }
/* First run, optional steps */
.${ROOT_CLASS} .wou-first-run-step { font-size: 11px; margin: 0 0 6px; }
.${ROOT_CLASS} .wou-first-run-actions-row { flex-direction: row; align-items: center; flex-wrap: wrap; }

/* ---- Clarity pass (all layouts) ---- */
/* The ask opens its one-line context when clicked; it reads as plain text. */
.${ROOT_CLASS} button.wou-ask-toggle {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 0;
  border-radius: 4px;
  color: var(--wou-muted);
  font: inherit;
}
.${ROOT_CLASS} button.wou-ask-toggle:hover { color: var(--wou-fg); }
.${ROOT_CLASS} button.wou-ask-toggle:focus-visible { outline: 2px solid var(--wou-accent); outline-offset: 2px; }
.${ROOT_CLASS} .wou-row-nested button.wou-ask-toggle { font-size: 13px; margin-top: 1px; }
.${ROOT_CLASS} .wou-row-nested button.wou-ask-toggle.wou-ask-only { color: var(--wou-fg); margin-top: 0; line-height: 18px; }
.${ROOT_CLASS} .wou-task-context-open {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  margin-top: 4px;
  padding-left: 8px;
  border-left: 2px solid var(--wou-border);
}
/* Open session swaps in for the "updated" time on hover or keyboard focus. */
.${ROOT_CLASS} .wou-session-slot { display: none; flex-shrink: 0; font-size: 12px; }
.${ROOT_CLASS} .wou-row:hover > .wou-row-body > .wou-card-title-line .wou-session-slot,
.${ROOT_CLASS} .wou-row:focus-within > .wou-row-body > .wou-card-title-line .wou-session-slot { display: inline-flex; }
.${ROOT_CLASS} .wou-row:hover > .wou-row-body > .wou-card-title-line:has(.wou-session-slot) .wou-updated-at,
.${ROOT_CLASS} .wou-row:focus-within > .wou-row-body > .wou-card-title-line:has(.wou-session-slot) .wou-updated-at { display: none; }
/* The "…" menu stays quiet until you point at the card. */
.${ROOT_CLASS} .wou-card-title-line button.wou-icon {
  border-color: transparent;
  background: transparent;
  opacity: 0;
  padding: 0 4px;
  min-width: 22px;
  line-height: 20px;
}
.${ROOT_CLASS} .wou-row:hover > .wou-row-body > .wou-card-title-line button.wou-icon,
.${ROOT_CLASS} .wou-row:focus-within > .wou-row-body > .wou-card-title-line button.wou-icon,
.${ROOT_CLASS} .wou-card-title-line button.wou-icon[aria-expanded="true"] { opacity: 1; }
.${ROOT_CLASS} .wou-card-title-line button.wou-icon:hover { background: var(--wou-menu-hover); }
@media (hover: none) {
  .${ROOT_CLASS} .wou-session-slot { display: inline-flex; }
  .${ROOT_CLASS} .wou-card-title-line button.wou-icon { opacity: 1; }
}

/* ---- Cards (default): each chat sits in its own box ---- */
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-row:not(.wou-row-nested),
.${ROOT_CLASS}.wou-layout-cards .wou-flat-list > .wou-row:not(.wou-row-nested),
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-group {
  border: 1px solid var(--wou-border);
  border-radius: 10px;
  margin: 0 0 8px;
  background: color-mix(in srgb, var(--wou-card) 60%, transparent);
}
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-row:not(.wou-row-nested) { padding: 10px 8px 10px 12px; }
.${ROOT_CLASS}.wou-layout-cards .wou-group-parent { padding: 10px 8px 6px 8px; }
.${ROOT_CLASS}.wou-layout-cards .wou-group-children { margin: 0 12px 6px 46px; padding-left: 0; border-left: none; }
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-row.wou-row-follow-selected:not(.wou-row-nested),
.${ROOT_CLASS}.wou-layout-cards .wou-flat-list > .wou-row.wou-row-follow-selected:not(.wou-row-nested),
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-group.wou-group-follow-selected {
  border-color: color-mix(in srgb, var(--wou-accent) 18%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 5%, var(--wou-card));
}
/* The whole card carries the highlight, so the header inside it does not draw a second box. */
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-group.wou-group-follow-selected > .wou-group-parent {
  border: none;
  background: none;
  margin: 0;
  padding: 10px 8px 6px 8px;
}

/* ---- Compact and Next up: one line per ask, no boxes ---- */
.${ROOT_CLASS}.wou-layout-compact .wou-row,
.${ROOT_CLASS}.wou-layout-focus .wou-row,
.${ROOT_CLASS}.wou-layout-compact .wou-group,
.${ROOT_CLASS}.wou-layout-focus .wou-group { border-bottom: none; }
.${ROOT_CLASS}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested),
.${ROOT_CLASS}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested) { padding-top: 5px; padding-bottom: 5px; border-radius: 6px; }
.${ROOT_CLASS}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested):hover,
.${ROOT_CLASS}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested):hover { background: var(--wou-menu-hover); }
/* Single tasks lead with the ask; the title becomes a small label above it. */
.${ROOT_CLASS}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested) .wou-topic,
.${ROOT_CLASS}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested) .wou-topic,
.${ROOT_CLASS}.wou-layout-compact .wou-flat-list > .wou-row .wou-topic,
.${ROOT_CLASS}.wou-layout-focus .wou-flat-list > .wou-row .wou-topic { font-weight: 400; font-size: 11.5px; color: var(--wou-muted); line-height: 16px; }
.${ROOT_CLASS}.wou-layout-compact .wou-section > .wou-row:not(.wou-row-nested) .wou-ask,
.${ROOT_CLASS}.wou-layout-focus .wou-section > .wou-row:not(.wou-row-nested) .wou-ask,
.${ROOT_CLASS}.wou-layout-compact .wou-flat-list > .wou-row .wou-ask,
.${ROOT_CLASS}.wou-layout-focus .wou-flat-list > .wou-row .wou-ask { color: var(--wou-fg); margin-top: 0; }
/* Group header becomes a quiet label row. */
.${ROOT_CLASS}.wou-layout-compact .wou-group-parent,
.${ROOT_CLASS}.wou-layout-focus .wou-group-parent { padding-top: 8px; padding-bottom: 2px; }
.${ROOT_CLASS}.wou-layout-compact .wou-group-title,
.${ROOT_CLASS}.wou-layout-focus .wou-group-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--wou-muted);
}
.${ROOT_CLASS}.wou-layout-compact .wou-group-count-pill,
.${ROOT_CLASS}.wou-layout-focus .wou-group-count-pill { display: none; }
.${ROOT_CLASS}.wou-layout-compact .wou-group-children,
.${ROOT_CLASS}.wou-layout-focus .wou-group-children { margin-bottom: 4px; border-left: none; padding-left: 0; margin-left: 33px; }
.${ROOT_CLASS}.wou-layout-compact .wou-row-nested,
.${ROOT_CLASS}.wou-layout-focus .wou-row-nested { padding: 4px 0; }

/* ---- Quiet metadata: agent, project, tags and due read as text, not buttons ---- */
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) {
  margin-top: 6px;
  column-gap: 0;
  row-gap: 2px;
  font-size: 12px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > :is(.wou-agent-chip, .wou-badge, .wou-project-chip, .wou-tag-chip, .wou-due-chip),
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > button.wou-project-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: auto;
  padding: 0;
  border: none;
  border-radius: 0;
  background: none;
  box-shadow: none;
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  color: var(--wou-muted);
}
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > .wou-tag-chip:not(.wou-tag-chip-more) {
  color: color-mix(in srgb, var(--wou-tag-hue) 70%, var(--wou-fg));
}
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > :is(.wou-due-today, .wou-due-overdue) {
  color: color-mix(in srgb, var(--wou-tag-red) 80%, var(--wou-fg));
  font-weight: 500;
}
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > .wou-due-overdue { font-weight: 600; }
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > button.wou-project-chip:hover {
  color: var(--wou-fg);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > button.wou-project-chip:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--wou-accent) 60%, transparent);
  outline-offset: 1px;
  border-radius: 3px;
}
/* A middle dot between neighbouring items: "Ada · Demo · Due today". */
.${ROOT_CLASS} :is(.wou-meta, .wou-nested-meta) > :is(.wou-agent-chip, .wou-badge, .wou-project-chip, .wou-tag-chip, .wou-due-chip) ~ :is(.wou-agent-chip, .wou-badge, .wou-project-chip, .wou-tag-chip, .wou-due-chip)::before {
  content: '·';
  content: '·' / '';
  margin: 0 6px;
  color: var(--wou-muted);
  font-weight: 400;
  text-decoration: none;
  display: inline-block;
}
/* Metadata sits under the ask, above the answer buttons. */
.${ROOT_CLASS} .wou-row-body > :is(.wou-meta, .wou-nested-meta) + .wou-answer { margin-top: 8px; }

/* ---- Answer bar: Yes · No · Reply · Later · Open session ---- */
/* The selected task: a quiet neutral tint, no edge bar. Sub-items carry their own inline padding
   (offset by an equal negative margin so text stays aligned) and a little space between them, so
   the tint frames the checkbox and never sits on a neighbouring ask's text. */
.${ROOT_CLASS} {
  --wou-active-tint: color-mix(in srgb, var(--wou-fg) 4%, transparent);
}
.${ROOT_CLASS} .wou-row.wou-row-active {
  background: var(--wou-active-tint);
  border-radius: 6px;
}
.${ROOT_CLASS} .wou-group-children > .wou-row-nested {
  padding-left: 6px;
  padding-right: 6px;
  margin-left: -6px;
  margin-right: -6px;
  border-radius: 6px;
}
.${ROOT_CLASS} .wou-group-children > .wou-row-nested + .wou-row-nested { margin-top: 4px; }
.${ROOT_CLASS}.wou-layout-cards .wou-group-children > .wou-row-nested { padding-top: 8px; padding-bottom: 8px; }
.${ROOT_CLASS}.wou-layout-cards .wou-group-children > .wou-row-nested:first-child { margin-top: 4px; }
.${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-row.wou-row-active:not(.wou-row-nested),
.${ROOT_CLASS}.wou-layout-cards .wou-flat-list > .wou-row.wou-row-active:not(.wou-row-nested) {
  background: color-mix(in srgb, var(--wou-fg) 4%, var(--wou-card));
  border-radius: 10px;
}
.${ROOT_CLASS} .wou-row[data-wou-task-id]:focus { outline: none; }
.${ROOT_CLASS} .wou-answer { margin-top: 8px; }
.${ROOT_CLASS} .wou-answer-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
/* Answer buttons keep one text/background pair in every state, so their contrast is exactly
   the theme's own: secondary buttons are fg on card, Yes is Hermes's contrast-adjusted
   solid-primary pair (or, on hosts without it, the inverse fg/card pair). Hover and press
   show through the border and shadow, never by blending the fill toward the text colour. */
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  box-sizing: border-box;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 6px;
  color: var(--wou-fg);
  background: var(--wou-card);
  border: 1px solid color-mix(in srgb, var(--wou-fg) 30%, var(--wou-border));
  box-shadow: 0 1px 2px color-mix(in srgb, var(--wou-fg) 16%, transparent);
  transition: border-color 80ms ease, box-shadow 80ms ease;
}
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--wou-fg) 60%, var(--wou-border));
  box-shadow: 0 1px 3px color-mix(in srgb, var(--wou-fg) 24%, transparent);
}
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn:active:not(:disabled) {
  border-color: color-mix(in srgb, var(--wou-fg) 60%, var(--wou-border));
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--wou-fg) 28%, transparent);
  transform: translateY(1px);
}
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--wou-accent) 60%, transparent);
  outline-offset: 1px;
}
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn.wou-answer-yes,
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn.wou-answer-yes:hover:not(:disabled),
.${ROOT_CLASS} .wou-answer-bar .wou-action-btn.wou-answer-yes:active:not(:disabled) {
  color: var(--dt-primary-solid-foreground, var(--wou-card));
  background: var(--dt-primary-solid, var(--wou-fg));
  border-color: var(--dt-primary-solid, var(--wou-fg));
}
.${ROOT_CLASS} .wou-answer-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.${ROOT_CLASS} .wou-answer-reply {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.${ROOT_CLASS} .wou-answer-reply-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  resize: vertical;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  padding: 6px 8px;
  border: 1px solid var(--wou-border);
  border-radius: 6px;
  background: var(--wou-card);
  color: var(--wou-fg);
}
.${ROOT_CLASS} .wou-answer-reply-input:focus {
  outline: 2px solid color-mix(in srgb, var(--wou-accent) 55%, transparent);
  outline-offset: 0;
  border-color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-answer-reply-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.${ROOT_CLASS} .wou-answer-reply-hint { font-size: 11px; }
.${ROOT_CLASS} .wou-answer-pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--wou-muted);
}
.${ROOT_CLASS} .wou-answer-unsupported {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--wou-muted);
}

/* ---- Next up box ---- */
.${ROOT_CLASS} .wou-next-up {
  border: 1px solid color-mix(in srgb, var(--wou-accent) 40%, var(--wou-border));
  background: color-mix(in srgb, var(--wou-accent) 7%, var(--wou-card));
  border-radius: 10px;
  padding: 12px 14px;
  margin: 10px 0 14px;
}
.${ROOT_CLASS} .wou-next-up-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--wou-accent);
}
.${ROOT_CLASS} .wou-next-up > .wou-row { padding: 6px 0 0; border-bottom: none; }
.${ROOT_CLASS} .wou-next-up > .wou-row-follow-selected { padding: 6px 8px; margin: 4px 0 0; }
.${ROOT_CLASS} .wou-next-up > .wou-row .wou-ask,
.${ROOT_CLASS} .wou-next-up > .wou-row button.wou-ask-toggle { color: var(--wou-fg); font-size: 14.5px; font-weight: 600; line-height: 1.35; }
.${ROOT_CLASS} .wou-next-up-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.${ROOT_CLASS} .wou-next-up-primary {
  background: var(--wou-accent);
  border-color: var(--wou-accent);
  color: var(--dt-primary-solid-foreground, #fcfcfc);
  font-weight: 600;
}

/* ---- Filters behind one button ---- */
.${ROOT_CLASS} .wou-filter-btn { position: relative; }
.${ROOT_CLASS} .wou-filter-btn[aria-expanded="true"] { border-color: var(--wou-accent); color: var(--wou-accent); }
.${ROOT_CLASS} .wou-filter-btn-on::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wou-accent);
}
.${ROOT_CLASS} .wou-header-row2 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.${ROOT_CLASS} .wou-header-row2 .wou-select,
.${ROOT_CLASS} .wou-header-row2 .wou-project-filter-wrap { width: 100%; min-width: 0; }
.${ROOT_CLASS} .wou-header-row2 .wou-clear-filters { grid-column: 1 / -1; justify-self: start; }
.${ROOT_CLASS} .wou-filter-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  min-width: 0;
}
.${ROOT_CLASS} .wou-filter-summary-text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--wou-muted);
  font-size: 11px;
}
.${ROOT_CLASS} .wou-filter-summary .wou-clear-filters { flex-shrink: 0; }

/* ---- Narrow panes: use the full width ---- */
.${ROOT_CLASS} { container-type: inline-size; }
@container (max-width: 380px) {
  .${ROOT_CLASS} .wou-header-row2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .${ROOT_CLASS} .wou-pane { padding: 10px 8px; }
  .${ROOT_CLASS} .wou-header-actions { gap: 2px; }
  .${ROOT_CLASS} .wou-header-actions .wou-icon-btn { width: 26px; height: 26px; border-color: transparent; background: transparent; }
  .${ROOT_CLASS} .wou-header-actions .wou-filter-btn[aria-expanded="true"] { border-color: var(--wou-accent); }
  .${ROOT_CLASS} .wou-title { font-size: 14px; }
  .${ROOT_CLASS} .wou-header-updated { display: none; }
  .${ROOT_CLASS} .wou-section-heading { padding-left: 0; padding-right: 0; }
  /* Single cards and group headers */
  .${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-row:not(.wou-row-nested) { padding: 8px 6px 8px 10px; }
  .${ROOT_CLASS}.wou-layout-cards .wou-group-parent,
  .${ROOT_CLASS}.wou-layout-cards .wou-section > .wou-group.wou-group-follow-selected > .wou-group-parent { padding: 8px 6px 4px 4px; }
  .${ROOT_CLASS} .wou-section > .wou-row:not(.wou-row-nested) { padding-left: 22px; padding-right: 4px; }
  .${ROOT_CLASS} .wou-group-parent { padding-right: 4px; }
  /* Asks under a group start under the group's checkbox, not its title. */
  .${ROOT_CLASS} .wou-group-children,
  .${ROOT_CLASS}.wou-layout-cards .wou-group-children,
  .${ROOT_CLASS}.wou-layout-compact .wou-group-children,
  .${ROOT_CLASS}.wou-layout-focus .wou-group-children { margin: 0 6px 6px 24px; padding-left: 0; border-left: none; }
  /* The "updated" time steals a column on every card; hide it, Open session still shows on hover/focus. */
  .${ROOT_CLASS} .wou-card-title-line .wou-updated-at { display: none; }
  .${ROOT_CLASS} .wou-next-up { padding: 10px; }
  /* A nested ask's "…" keeps its own column (never covers text), just a narrower one. */
  .${ROOT_CLASS} .wou-icon-nested { min-width: 18px; width: 18px; }
  .${ROOT_CLASS} .wou-row-nested { gap: 6px; }
}
`

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  id: string
}

export function Switch({ checked, onChange, label, description, id }: SwitchProps) {
  return (
    <div className="wou-settings-toggle-row">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        className={`wou-switch${checked ? ' wou-switch-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="wou-switch-knob" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="wou-settings-toggle-label"
        onClick={() => onChange(!checked)}
      >
        <span id={`${id}-label`} className="wou-settings-row-label">{label}</span>
        {description ? (
          <span className="wou-muted wou-settings-row-desc">{description}</span>
        ) : null}
      </button>
    </div>
  )
}

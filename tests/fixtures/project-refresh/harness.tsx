import { createRoot } from 'react-dom/client'
import { TasksPanel } from '../../../src/ui/TasksPanel'
import { globalStyles } from '../../../src/ui/styles'
import { makeHarnessCtx, probe } from './hermes-stub'

// One context and one mount, exactly as in the reviewer's profile-change probe.
const ctx = makeHarnessCtx()
Object.assign(window, { projectProbe: probe })
const style = document.createElement('style')
style.textContent = globalStyles
document.head.appendChild(style)
createRoot(document.getElementById('root')!).render(<TasksPanel ctx={ctx} variant="page" />)

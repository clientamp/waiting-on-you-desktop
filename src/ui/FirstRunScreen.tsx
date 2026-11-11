import type { PluginContext } from '@hermes/plugin-sdk'
import { useState } from 'react'
import { firstRunCapSentence, modeCheckDescription, type WouMode } from '../model'
import type { HermesModelInfo, PluginSettings, Tag } from './api'
import { DecisionModelControls } from './DecisionModelControls'
import { SuggestTagsPanel } from './SuggestTagsPanel'
import { strings } from './strings'
import { firstRunTeachState, type TeachAvailability } from './teachPrompt'
import { IconRefresh } from './icons'

interface FirstRunScreenProps {
  settings: PluginSettings
  model: HermesModelInfo
  scanning: boolean
  onStart: () => void
  onChangeSettings: () => void
}

export function FirstRunScreen({
  settings,
  model,
  scanning,
  onStart,
  onChangeSettings,
}: FirstRunScreenProps) {
  const mode = settings.mode as WouMode
  const capSentence = firstRunCapSentence(settings.daily_call_cap)
  const checkDesc = modeCheckDescription(mode, settings.sweep_minutes)

  return (
    <div className="wou-first-run">
      <h2 className="wou-first-run-title">{strings.pluginName}</h2>
      <p>{strings.firstRunLine1}</p>
      <p>{strings.firstRunLine2(model.label)}</p>
      <p>{strings.firstRunLine3(checkDesc, capSentence, settings.lookback_days)}</p>
      {scanning ? (
        <p className="wou-muted" role="status">
          {strings.scanningHint}
        </p>
      ) : null}
      <div className="wou-first-run-actions">
        <button type="button" onClick={onStart} disabled={scanning} aria-busy={scanning}>
          {scanning ? strings.scanning : strings.firstRunStart}
        </button>
        <button type="button" className="wou-link" onClick={onChangeSettings} disabled={scanning}>
          {strings.firstRunChangeSettings}
        </button>
      </div>
    </div>
  )
}

export type FirstRunStep = 'decision' | 'tags' | 'teach'

const STEP_ORDER: FirstRunStep[] = ['decision', 'tags', 'teach']

interface FirstRunStepsProps {
  ctx: PluginContext
  tags: Tag[]
  scanning: boolean
  teachAvailability: TeachAvailability
  onAddTag: (body: { name: string; color: string; hint: string }) => Promise<Tag>
  onTeachNow: () => void
  /** Leaves setup. Every step can be skipped, so this is always reachable. */
  onFinish: () => void
}

/** Optional steps after consent. None of them blocks finishing setup. */
export function FirstRunSteps({ ctx, tags, scanning, teachAvailability, onAddTag, onTeachNow, onFinish }: FirstRunStepsProps) {
  const teachState = firstRunTeachState(scanning, teachAvailability)
  const [step, setStep] = useState<FirstRunStep>('decision')
  const index = STEP_ORDER.indexOf(step)
  const next = () => {
    const following = STEP_ORDER[index + 1]
    if (following) setStep(following)
    else onFinish()
  }

  return (
    <div className="wou-first-run wou-first-run-steps">
      <p className="wou-muted wou-first-run-step">{strings.firstRunStepOf(index + 1, STEP_ORDER.length)}</p>
      {step === 'decision' ? (
        <>
          <h2 className="wou-first-run-title">{strings.firstRunDecisionTitle}</h2>
          <p>{strings.decisionIntro}</p>
          <DecisionModelControls ctx={ctx} compact />
          <div className="wou-first-run-actions wou-first-run-actions-row">
            <button type="button" onClick={next}>
              {strings.firstRunNext}
            </button>
            <button type="button" className="wou-link" onClick={next}>
              {strings.firstRunSkip}
            </button>
          </div>
        </>
      ) : null}
      {step === 'tags' ? (
        <>
          <h2 className="wou-first-run-title">{strings.firstRunTagsTitle}</h2>
          <p>{strings.firstRunTagsIntro}</p>
          <SuggestTagsPanel ctx={ctx} tags={tags} onAddTag={onAddTag} />
          <div className="wou-first-run-actions wou-first-run-actions-row">
            <button type="button" onClick={next}>
              {strings.firstRunNext}
            </button>
            <button type="button" className="wou-link" onClick={next}>
              {strings.firstRunSkip}
            </button>
          </div>
        </>
      ) : null}
      {step === 'teach' ? (
        <>
          <h2 className="wou-first-run-title">{strings.firstRunTeachTitle}</h2>
          <p>{strings.firstRunTeachIntro}</p>
          {teachState === 'waiting' ? (
            <p className="wou-muted wou-teach-wait" role="status">
              <IconRefresh className="wou-icon-spin" />
              {scanning ? strings.firstRunTeachWait : strings.teachLoading}
            </p>
          ) : null}
          {teachState === 'empty' ? (
            <>
              <p className="wou-muted">{strings.firstRunTeachEmpty}</p>
              <button type="button" onClick={onFinish}>{strings.firstRunFinish}</button>
            </>
          ) : (
            <div className="wou-first-run-actions wou-first-run-actions-row">
              <button type="button" onClick={onTeachNow} disabled={teachState !== 'ready'}>
                {strings.firstRunTeachNow}
              </button>
              <button type="button" className="wou-link" onClick={onFinish}>
                {strings.firstRunLater}
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

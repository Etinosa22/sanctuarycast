// What the detector may do on its own, by mode. Pure, so every rule is tested.
//   suggest: cards only.
//   preview: put the passage in Preview for review, unless that would replace
//            something the operator staged themselves and hasn't sent yet.
//   live:    when sure (a clearly said reference or a long exact quote), put it
//            in Preview and Live at once; otherwise behave like "preview".

import type { AiMode, EngineAction, PresentationState, Slide } from '../shared/types'

export interface AutoInput {
  mode: AiMode
  confidence: 'high' | 'medium'
  source: 'explicit' | 'context' | 'quote'
  state: Pick<PresentationState, 'preview' | 'live'>
  /** Id of the last slide the detector itself put in Preview. */
  lastAutoPreviewId: string | null
}

export interface AutoResult {
  actions: EngineAction[]
  applied: 'preview' | 'live' | null
}

/** "verse 18" on its own leans on context that may be stale, so it never goes Live by itself. */
export const sureEnoughForLive = (i: Pick<AutoInput, 'confidence' | 'source'>) => i.confidence === 'high' && i.source !== 'context'

export function autoActions(input: AutoInput, slide: Slide): AutoResult {
  if (input.mode === 'suggest') return { actions: [], applied: null }
  if (input.mode === 'live' && sureEnoughForLive(input)) {
    return { actions: [{ type: 'stage', slide }, { type: 'goLive' }], applied: 'live' }
  }
  const { preview, live } = input.state
  const previewFree = !preview || preview.slide.id === live?.slide.id || preview.slide.id === input.lastAutoPreviewId
  return previewFree ? { actions: [{ type: 'stage', slide }], applied: 'preview' } : { actions: [], applied: null }
}

export const isAiMode = (v: unknown): v is AiMode => v === 'suggest' || v === 'preview' || v === 'live'

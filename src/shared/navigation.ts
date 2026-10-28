// What each live-control key does, as plain engine actions. Pure: no DOM, no
// IPC, so every case is unit-tested. Every path to Live goes through Preview.

import type { EngineAction, PresentationState, Slide } from './types'

type Pos = Pick<PresentationState, 'preview' | 'live'>

const indexOf = (slides: Slide[], id: string | undefined) => (id ? slides.findIndex((s) => s.id === id) : -1)

/** Where the operator is in this item: Preview if it is from here, else Live, else nowhere (-1). */
function position(slides: Slide[], s: Pos): number {
  const p = indexOf(slides, s.preview?.slide.id)
  return p >= 0 ? p : indexOf(slides, s.live?.slide.id)
}

/**
 * Space, "send and queue": if Preview holds something not yet live, send it
 * and load the slide after it. If Preview is empty or already live, only load
 * the next slide (the first one if nothing from this item is up yet).
 */
export function spaceActions(slides: Slide[], s: Pos): EngineAction[] {
  const previewPending = s.preview && s.preview.slide.id !== s.live?.slide.id
  if (previewPending) {
    const i = indexOf(slides, s.preview!.slide.id)
    const next = i >= 0 ? slides[i + 1] : undefined
    return next ? [{ type: 'goLive' }, { type: 'stage', slide: next }] : [{ type: 'goLive' }]
  }
  const i = indexOf(slides, s.live?.slide.id)
  const next = i >= 0 ? slides[i + 1] : slides[0]
  return next ? [{ type: 'stage', slide: next }] : []
}

/** Arrow keys: move Preview one slide; Live is untouched. */
export function stepActions(slides: Slide[], s: Pos, delta: 1 | -1): EngineAction[] {
  const i = position(slides, s)
  const target = i < 0 ? (delta > 0 ? slides[0] : undefined) : slides[i + delta]
  return target ? [{ type: 'stage', slide: target }] : []
}

export const isChorus = (slide: Slide) => slide.kind === 'song' && /^C\d*$/.test(slide.section ?? '')

/** C: the next chorus after where we are (wrapping to the first), into Preview. */
export function chorusActions(slides: Slide[], s: Pos): EngineAction[] {
  const from = position(slides, s)
  const after = slides.findIndex((sl, i) => i > from && isChorus(sl))
  const target = after >= 0 ? slides[after] : slides.find(isChorus)
  return target ? [{ type: 'stage', slide: target }] : []
}

/** 1–9 → index into the service order, or null for any other key. */
export function itemIndexForKey(key: string): number | null {
  return /^[1-9]$/.test(key) ? Number(key) - 1 : null
}

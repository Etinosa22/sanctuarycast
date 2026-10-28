// Presentation engine: the single source of truth for what every output shows.
// Pure TypeScript, no Electron imports, so every transition is unit-testable.

import type {
  Background,
  EngineAction,
  Frame,
  OutputView,
  PresentationState,
  StageView,
  Theme
} from '../../shared/types'

export const DEFAULT_BACKGROUND: Background = { kind: 'colour', colour: '#0b1d3a' }

export const DEFAULT_THEME: Theme = {
  fontFamily: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
  fontSize: 72,
  colour: '#ffffff',
  shadow: true,
  outline: false,
  align: 'center',
  position: 'middle',
  margin: 96
}

export function initialState(): PresentationState {
  return {
    rev: 0,
    preview: null,
    live: null,
    blanked: false,
    clearText: false,
    logo: false,
    background: DEFAULT_BACKGROUND,
    theme: DEFAULT_THEME,
    liveSince: null
  }
}

/**
 * Applies one action. Returns the same object when nothing changes, so callers
 * can skip broadcasting. Live is only ever replaced by goLive or clearLive.
 */
export function reduce(state: PresentationState, action: EngineAction, now: number): PresentationState {
  switch (action.type) {
    case 'stage': {
      const preview: Frame = { slide: action.slide, background: state.background, theme: state.theme }
      return { ...state, preview }
    }

    case 'editPreview': {
      if (!state.preview || state.preview.slide.text === action.text) return state
      const slide = { ...state.preview.slide, text: action.text }
      return { ...state, preview: { ...state.preview, slide } }
    }

    case 'clearPreview':
      return state.preview ? { ...state, preview: null } : state

    case 'goLive':
      if (!state.preview) return state
      // Sending new text implies the operator wants text shown; blank and logo
      // stay until the operator lifts them, so a deliberate blank is never undone.
      return { ...state, live: state.preview, clearText: false, liveSince: now }

    case 'clearLive':
      return state.live ? { ...state, live: null, liveSince: null } : state

    case 'setBackground': {
      const preview = state.preview ? { ...state.preview, background: action.background } : null
      return { ...state, background: action.background, preview }
    }

    case 'setTheme': {
      const theme = { ...state.theme, ...action.theme }
      const preview = state.preview ? { ...state.preview, theme: { ...state.preview.theme, ...action.theme } } : null
      return { ...state, theme, preview }
    }

    case 'toggleMask':
      switch (action.mask) {
        case 'blank':
          // Blank and logo are alternative full-screen covers; one replaces the other.
          return { ...state, blanked: !state.blanked, logo: false }
        case 'logo':
          return { ...state, logo: !state.logo, blanked: false }
        case 'clearText':
          return { ...state, clearText: !state.clearText }
      }
      return state

    case 'unmask':
      if (!state.blanked && !state.clearText && !state.logo) return state
      return { ...state, blanked: false, clearText: false, logo: false }
  }
}

export function toOutputView(s: PresentationState): OutputView {
  return { rev: s.rev, live: s.live, blanked: s.blanked, clearText: s.clearText, logo: s.logo }
}

export function toStageView(s: PresentationState): StageView {
  return { ...toOutputView(s), next: s.preview, liveSince: s.liveSince }
}

type Listener = (state: PresentationState) => void

export class PresentationEngine {
  private current: PresentationState
  private listeners = new Set<Listener>()

  constructor(initial: PresentationState = initialState(), private clock: () => number = Date.now) {
    this.current = initial
  }

  get state(): PresentationState {
    return this.current
  }

  dispatch(action: EngineAction): boolean {
    const next = reduce(this.current, action, this.clock())
    if (next === this.current) return false
    this.current = { ...next, rev: this.current.rev + 1 }
    for (const l of this.listeners) l(this.current)
    return true
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

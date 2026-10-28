import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_THEME,
  PresentationEngine,
  initialState,
  reduce,
  toOutputView,
  toStageView
} from '../src/main/engine/presentationEngine'
import type { Background, PresentationState, Slide } from '../src/shared/types'

const NOW = 1_000_000
const slideA: Slide = { id: 'a', kind: 'scripture', text: 'For God so loved the world', label: 'John 3:16 (KJV)' }
const slideB: Slide = { id: 'b', kind: 'song', text: 'Amazing grace! How sweet the sound' }
const wine: Background = { kind: 'colour', colour: '#4a1022' }

const run = (state: PresentationState, ...actions: Parameters<typeof reduce>[1][]) =>
  actions.reduce((s, a) => reduce(s, a, NOW), state)

describe('initial state', () => {
  it('starts with nothing in Preview or Live and no masks', () => {
    const s = initialState()
    expect(s).toMatchObject({ preview: null, live: null, blanked: false, clearText: false, logo: false, liveSince: null })
    expect(s.background).toEqual(DEFAULT_BACKGROUND)
    expect(s.theme).toEqual(DEFAULT_THEME)
  })
})

describe('stage', () => {
  it('puts the slide in Preview with the current default background and theme', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA })
    expect(s.preview).toEqual({ slide: slideA, background: DEFAULT_BACKGROUND, theme: DEFAULT_THEME })
  })

  it('never touches Live', () => {
    const live = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' })
    const s = run(live, { type: 'stage', slide: slideB })
    expect(s.live).toBe(live.live)
    expect(s.preview?.slide).toBe(slideB)
  })
})

describe('editPreview', () => {
  it('changes Preview text', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'editPreview', text: 'Fixed typo' })
    expect(s.preview?.slide.text).toBe('Fixed typo')
    expect(s.preview?.slide.id).toBe('a')
  })

  it('does not change the slide already on Live, even though it came from Preview', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' }, { type: 'editPreview', text: 'Edited' })
    expect(s.live?.slide.text).toBe(slideA.text)
    expect(s.preview?.slide.text).toBe('Edited')
  })

  it('is a no-op with an empty Preview or unchanged text', () => {
    const empty = initialState()
    expect(reduce(empty, { type: 'editPreview', text: 'x' }, NOW)).toBe(empty)
    const staged = run(empty, { type: 'stage', slide: slideA })
    expect(reduce(staged, { type: 'editPreview', text: slideA.text }, NOW)).toBe(staged)
  })
})

describe('clearPreview', () => {
  it('empties Preview and leaves Live', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' }, { type: 'clearPreview' })
    expect(s.preview).toBeNull()
    expect(s.live?.slide).toBe(slideA)
  })

  it('is a no-op when Preview is already empty', () => {
    const s = initialState()
    expect(reduce(s, { type: 'clearPreview' }, NOW)).toBe(s)
  })
})

describe('goLive', () => {
  it('copies Preview to Live and starts the live timer', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' })
    expect(s.live).toEqual(s.preview)
    expect(s.liveSince).toBe(NOW)
  })

  it('is the only way a slide reaches Live', () => {
    let s = initialState()
    s = run(s, { type: 'stage', slide: slideA }, { type: 'editPreview', text: 'x' }, { type: 'setBackground', background: wine })
    expect(s.live).toBeNull()
    s = run(s, { type: 'goLive' })
    expect(s.live?.slide.text).toBe('x')
  })

  it('is a no-op with nothing in Preview', () => {
    const s = initialState()
    expect(reduce(s, { type: 'goLive' }, NOW)).toBe(s)
  })

  it('restores text after Clear text, so the new slide is visible', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' }, { type: 'toggleMask', mask: 'clearText' }, { type: 'stage', slide: slideB }, { type: 'goLive' })
    expect(s.clearText).toBe(false)
  })

  it('keeps a deliberate blank or logo screen in place', () => {
    const blanked = run(initialState(), { type: 'toggleMask', mask: 'blank' }, { type: 'stage', slide: slideA }, { type: 'goLive' })
    expect(blanked.blanked).toBe(true)
    expect(blanked.live?.slide).toBe(slideA)
    const logo = run(initialState(), { type: 'toggleMask', mask: 'logo' }, { type: 'stage', slide: slideA }, { type: 'goLive' })
    expect(logo.logo).toBe(true)
  })
})

describe('clearLive', () => {
  it('removes the Live slide and stops the timer', () => {
    const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' }, { type: 'clearLive' })
    expect(s.live).toBeNull()
    expect(s.liveSince).toBeNull()
    expect(s.preview?.slide).toBe(slideA)
  })

  it('is a no-op when nothing is Live', () => {
    const s = initialState()
    expect(reduce(s, { type: 'clearLive' }, NOW)).toBe(s)
  })
})

describe('setBackground', () => {
  it('changes the default and Preview, never Live', () => {
    const live = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' })
    const s = run(live, { type: 'setBackground', background: wine })
    expect(s.background).toEqual(wine)
    expect(s.preview?.background).toEqual(wine)
    expect(s.live?.background).toEqual(DEFAULT_BACKGROUND)
  })

  it('applies to slides staged afterwards', () => {
    const s = run(initialState(), { type: 'setBackground', background: wine }, { type: 'stage', slide: slideB })
    expect(s.preview?.background).toEqual(wine)
    expect(s.preview).not.toBeNull()
  })

  it('works with an empty Preview', () => {
    const s = run(initialState(), { type: 'setBackground', background: wine })
    expect(s.preview).toBeNull()
    expect(s.background).toEqual(wine)
  })
})

describe('setTheme', () => {
  it('merges into the default and Preview, never Live', () => {
    const live = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' })
    const s = run(live, { type: 'setTheme', theme: { fontSize: 96, colour: '#ffee00' } })
    expect(s.theme).toEqual({ ...DEFAULT_THEME, fontSize: 96, colour: '#ffee00' })
    expect(s.preview?.theme.fontSize).toBe(96)
    expect(s.live?.theme).toEqual(DEFAULT_THEME)
  })
})

describe('masks', () => {
  it('blank toggles on and off', () => {
    const on = run(initialState(), { type: 'toggleMask', mask: 'blank' })
    expect(on.blanked).toBe(true)
    expect(run(on, { type: 'toggleMask', mask: 'blank' }).blanked).toBe(false)
  })

  it('blank and logo replace each other', () => {
    const logo = run(initialState(), { type: 'toggleMask', mask: 'logo' })
    const blank = run(logo, { type: 'toggleMask', mask: 'blank' })
    expect(blank).toMatchObject({ blanked: true, logo: false })
    expect(run(blank, { type: 'toggleMask', mask: 'logo' })).toMatchObject({ blanked: false, logo: true })
  })

  it('clear text is independent of blank', () => {
    const s = run(initialState(), { type: 'toggleMask', mask: 'clearText' }, { type: 'toggleMask', mask: 'blank' })
    expect(s).toMatchObject({ clearText: true, blanked: true })
  })

  it('work with nothing Live and never change Preview or Live', () => {
    const live = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' }, { type: 'stage', slide: slideB })
    for (const mask of ['blank', 'clearText', 'logo'] as const) {
      const s = run(live, { type: 'toggleMask', mask })
      expect(s.live).toBe(live.live)
      expect(s.preview).toBe(live.preview)
    }
    expect(run(initialState(), { type: 'toggleMask', mask: 'blank' }).blanked).toBe(true)
  })

  it('unmask lifts all masks, and is a no-op when none are on', () => {
    const s = run(initialState(), { type: 'toggleMask', mask: 'clearText' }, { type: 'toggleMask', mask: 'logo' }, { type: 'unmask' })
    expect(s).toMatchObject({ blanked: false, clearText: false, logo: false })
    expect(reduce(s, { type: 'unmask' }, NOW)).toBe(s)
  })
})

describe('views', () => {
  const s = run(initialState(), { type: 'stage', slide: slideA }, { type: 'goLive' }, { type: 'stage', slide: slideB }, { type: 'toggleMask', mask: 'blank' })

  it('Main Output gets Live and masks, never Preview', () => {
    const v = toOutputView(s)
    expect(v).toEqual({ rev: s.rev, live: s.live, blanked: true, clearText: false, logo: false })
    expect(JSON.stringify(v)).not.toContain(slideB.text)
  })

  it('Stage Display gets Live, the next slide and the timer', () => {
    expect(toStageView(s)).toMatchObject({ live: s.live, next: s.preview, liveSince: NOW, blanked: true })
  })
})

describe('PresentationEngine', () => {
  it('bumps rev and notifies listeners on change only', () => {
    const engine = new PresentationEngine(initialState(), () => NOW)
    const listener = vi.fn()
    engine.subscribe(listener)
    expect(engine.dispatch({ type: 'goLive' })).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(engine.dispatch({ type: 'stage', slide: slideA })).toBe(true)
    expect(engine.dispatch({ type: 'goLive' })).toBe(true)
    expect(engine.state.rev).toBe(2)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith(engine.state)
  })

  it('stops notifying after unsubscribe', () => {
    const engine = new PresentationEngine()
    const listener = vi.fn()
    const off = engine.subscribe(listener)
    off()
    engine.dispatch({ type: 'toggleMask', mask: 'blank' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('uses the injected clock for the live timer', () => {
    const engine = new PresentationEngine(initialState(), () => 42)
    engine.dispatch({ type: 'stage', slide: slideA })
    engine.dispatch({ type: 'goLive' })
    expect(engine.state.liveSince).toBe(42)
  })
})

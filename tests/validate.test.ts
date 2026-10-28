import { describe, expect, it } from 'vitest'
import { DEFAULT_BACKGROUND, DEFAULT_THEME, initialState } from '../src/main/engine/presentationEngine'
import { hydrateState, isEngineAction } from '../src/main/engine/validate'

const slide = { id: 'a', kind: 'scripture', text: 'Jesus wept.', label: 'John 11:35 (KJV)' }

describe('isEngineAction', () => {
  it('accepts every well-formed action', () => {
    const ok = [
      { type: 'stage', slide },
      { type: 'editPreview', text: '' },
      { type: 'clearPreview' },
      { type: 'goLive' },
      { type: 'clearLive' },
      { type: 'setBackground', background: { kind: 'colour', colour: '#000' } },
      { type: 'setBackground', background: { kind: 'image', file: '0b8e9f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg' } },
      { type: 'setTheme', theme: { fontSize: 80, position: 'bottom' } },
      { type: 'toggleMask', mask: 'blank' },
      { type: 'toggleMask', mask: 'clearText' },
      { type: 'toggleMask', mask: 'logo' },
      { type: 'unmask' }
    ]
    for (const a of ok) expect(isEngineAction(a), JSON.stringify(a)).toBe(true)
  })

  it('rejects malformed actions', () => {
    const bad = [
      null,
      'goLive',
      { type: 'setLive', slide },
      { type: 'stage' },
      { type: 'stage', slide: { ...slide, kind: 'video' } },
      { type: 'editPreview', text: 3 },
      { type: 'setBackground', background: { kind: 'colour' } },
      { type: 'setBackground', background: { kind: 'image', file: '../../etc/passwd' } },
      { type: 'setTheme', theme: { fontSize: -5 } },
      { type: 'setTheme', theme: { evil: true } },
      { type: 'toggleMask', mask: 'everything' }
    ]
    for (const a of bad) expect(isEngineAction(a), JSON.stringify(a)).toBe(false)
  })
})

describe('hydrateState (crash recovery)', () => {
  const frame = { slide, background: DEFAULT_BACKGROUND, theme: DEFAULT_THEME }

  it('reopens at the last Live slide with masks, resetting the timer', () => {
    const saved = { ...initialState(), rev: 57, live: frame, preview: frame, blanked: true, liveSince: 1 }
    const s = hydrateState(JSON.parse(JSON.stringify(saved)), 999)
    expect(s.live).toEqual(frame)
    expect(s.preview).toEqual(frame)
    expect(s.blanked).toBe(true)
    expect(s.liveSince).toBe(999)
    expect(s.rev).toBe(0)
  })

  it('falls back to defaults for garbage', () => {
    expect(hydrateState(null, 1)).toEqual(initialState())
    expect(hydrateState('nonsense', 1)).toEqual(initialState())
    const s = hydrateState({ live: { slide: 'bad' }, blanked: 'yes', background: 4 }, 1)
    expect(s).toEqual(initialState())
  })

  it('fills theme fields missing from an older file', () => {
    const s = hydrateState({ live: { ...frame, theme: { fontSize: 90 } } }, 1)
    expect(s.live?.theme).toEqual({ ...DEFAULT_THEME, fontSize: 90 })
  })
})

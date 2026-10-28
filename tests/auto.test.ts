import { describe, expect, it } from 'vitest'
import { autoActions, type AutoInput } from '../src/ai/auto'
import { DEFAULT_BACKGROUND, DEFAULT_THEME, initialState, reduce } from '../src/main/engine/presentationEngine'
import type { Frame, Slide } from '../src/shared/types'

const verse: Slide = { id: 'bible-KJV-John-3-16-1', kind: 'scripture', label: 'John 3:16 (KJV)', text: 'For God so loved the world' }
const song: Slide = { id: 'song-1', kind: 'song', text: 'Amazing grace' }
const frame = (slide: Slide): Frame => ({ slide, background: DEFAULT_BACKGROUND, theme: DEFAULT_THEME })

const input = (over: Partial<AutoInput> = {}): AutoInput => ({
  mode: 'preview',
  confidence: 'high',
  source: 'explicit',
  state: { preview: null, live: null },
  lastAutoPreviewId: null,
  ...over
})
const types = (r: ReturnType<typeof autoActions>) => r.actions.map((a) => a.type)

describe('suggest mode', () => {
  it('only makes a card', () => {
    expect(autoActions(input({ mode: 'suggest' }), verse)).toEqual({ actions: [], applied: null })
  })
})

describe('auto preview', () => {
  it('puts the passage in an empty Preview', () => {
    const r = autoActions(input(), verse)
    expect(r).toEqual({ actions: [{ type: 'stage', slide: verse }], applied: 'preview' })
  })

  it('replaces Preview when it only repeats what is Live', () => {
    expect(autoActions(input({ state: { preview: frame(song), live: frame(song) } }), verse).applied).toBe('preview')
  })

  it('replaces its own earlier suggestion', () => {
    expect(autoActions(input({ state: { preview: frame(song), live: null }, lastAutoPreviewId: 'song-1' }), verse).applied).toBe('preview')
  })

  it('never replaces something the operator staged and has not sent yet', () => {
    expect(autoActions(input({ state: { preview: frame(song), live: null } }), verse)).toEqual({ actions: [], applied: null })
  })

  it('never touches Live', () => {
    for (const confidence of ['high', 'medium'] as const) expect(types(autoActions(input({ confidence }), verse))).not.toContain('goLive')
  })
})

describe('auto live', () => {
  it('a clearly said reference goes to Preview and Live', () => {
    const r = autoActions(input({ mode: 'live' }), verse)
    expect(r.applied).toBe('live')
    // Through the real engine: both panes end up showing the passage.
    const s = r.actions.reduce((st, a) => reduce(st, a, 0), initialState())
    expect(s.preview?.slide).toBe(verse)
    expect(s.live?.slide).toBe(verse)
  })

  it('a long exact quote goes Live too', () => {
    expect(autoActions(input({ mode: 'live', source: 'quote', confidence: 'high' }), verse).applied).toBe('live')
  })

  it('anything less sure only goes to Preview', () => {
    expect(autoActions(input({ mode: 'live', confidence: 'medium' }), verse).applied).toBe('preview')
    expect(autoActions(input({ mode: 'live', source: 'context' }), verse).applied).toBe('preview')
    expect(autoActions(input({ mode: 'live', source: 'quote', confidence: 'medium' }), verse).applied).toBe('preview')
  })

  it('a less sure one still respects what the operator staged', () => {
    expect(autoActions(input({ mode: 'live', confidence: 'medium', state: { preview: frame(song), live: null } }), verse).applied).toBeNull()
  })
})

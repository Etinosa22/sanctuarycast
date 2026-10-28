import { describe, expect, it } from 'vitest'
import { DEFAULT_BACKGROUND, DEFAULT_THEME, initialState, reduce } from '../src/main/engine/presentationEngine'
import { chorusActions, itemIndexForKey, spaceActions, stepActions } from '../src/shared/navigation'
import { songToItem } from '../src/shared/lyrics'
import type { EngineAction, PresentationState, Slide } from '../src/shared/types'

// V1, C, V2, C, B, C — the chorus is stored once but shown three times.
const song = songToItem(
  {
    id: 'g',
    title: 'Test song',
    author: '',
    ccli: '',
    sections: [
      { label: 'V1', text: 'verse one' },
      { label: 'C', text: 'chorus' },
      { label: 'V2', text: 'verse two' },
      { label: 'B', text: 'bridge' }
    ],
    arrangement: ['V1', 'C', 'V2', 'C', 'B', 'C'],
    updatedAt: 0
  },
  'item'
)
const slides = song.slides
const order = (s: Slide | undefined) => (s ? `${slides.indexOf(s) + 1}:${s.section}` : '—')

const frame = (slide: Slide) => ({ slide, background: DEFAULT_BACKGROUND, theme: DEFAULT_THEME })
const pos = (preview?: number, live?: number) => ({
  preview: preview === undefined ? null : frame(slides[preview]),
  live: live === undefined ? null : frame(slides[live])
})
const staged = (actions: EngineAction[]) => actions.map((a) => (a.type === 'stage' ? `stage ${order(a.slide)}` : a.type))

/** Runs key presses through the real engine reducer. */
function press(state: PresentationState, key: (s: PresentationState) => EngineAction[], times = 1): PresentationState {
  for (let i = 0; i < times; i++) state = key(state).reduce((st, a) => reduce(st, a, 0), state)
  return state
}
const show = (s: PresentationState) => `P ${s.preview ? order(s.preview.slide) : '—'} | L ${s.live ? order(s.live.slide) : '—'}`

describe('Space: send and queue', () => {
  it('with nothing up, loads the first slide into Preview only', () => {
    expect(staged(spaceActions(slides, pos()))).toEqual(['stage 1:V1'])
  })

  it('sends Preview live and queues the next slide', () => {
    expect(staged(spaceActions(slides, pos(0)))).toEqual(['goLive', 'stage 2:C'])
    expect(staged(spaceActions(slides, pos(1, 0)))).toEqual(['goLive', 'stage 3:V2'])
  })

  it('when Preview is already live (after Enter), only queues the next slide', () => {
    expect(staged(spaceActions(slides, pos(2, 2)))).toEqual(['stage 4:C'])
  })

  it('on the last slide, sends it and then stops', () => {
    expect(staged(spaceActions(slides, pos(5, 4)))).toEqual(['goLive'])
    expect(staged(spaceActions(slides, pos(5, 5)))).toEqual([])
  })

  it('sends a Preview slide from elsewhere (e.g. a search) without queuing from this item', () => {
    const other: Slide = { id: 'x', kind: 'scripture', text: 'Jesus wept.' }
    expect(staged(spaceActions(slides, { preview: frame(other), live: null }))).toEqual(['goLive'])
  })

  it('walks a whole song one press per slide, Preview always one ahead', () => {
    let s = press(initialState(), (st) => spaceActions(slides, st))
    expect(show(s)).toBe('P 1:V1 | L —')
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      s = press(s, (st) => spaceActions(slides, st))
      seen.push(show(s))
    }
    expect(seen).toEqual([
      'P 2:C | L 1:V1',
      'P 3:V2 | L 2:C',
      'P 4:C | L 3:V2',
      'P 5:B | L 4:C',
      'P 6:C | L 5:B',
      'P 6:C | L 6:C'
    ])
  })

  it('never changes Live without Preview holding that exact slide first', () => {
    let s = initialState()
    for (let i = 0; i < 10; i++) {
      const before = s
      s = press(s, (st) => spaceActions(slides, st))
      if (s.live !== before.live) expect(s.live).toBe(before.preview)
    }
  })
})

describe('arrow keys', () => {
  it('step Preview forward and back without touching Live', () => {
    expect(staged(stepActions(slides, pos(1, 0), 1))).toEqual(['stage 3:V2'])
    expect(staged(stepActions(slides, pos(1, 0), -1))).toEqual(['stage 1:V1'])
  })

  it('step from Live when Preview is from another item', () => {
    const other: Slide = { id: 'x', kind: 'scripture', text: 'Jesus wept.' }
    expect(staged(stepActions(slides, { preview: frame(other), live: frame(slides[2]) }, 1))).toEqual(['stage 4:C'])
  })

  it('stop at the ends', () => {
    expect(stepActions(slides, pos(0), -1)).toEqual([])
    expect(stepActions(slides, pos(5), 1)).toEqual([])
    expect(staged(stepActions(slides, pos(), 1))).toEqual(['stage 1:V1'])
    expect(stepActions(slides, pos(), -1)).toEqual([])
  })
})

describe('C: chorus', () => {
  it('picks the next chorus after the current position', () => {
    expect(staged(chorusActions(slides, pos(2, 2)))).toEqual(['stage 4:C'])
    expect(staged(chorusActions(slides, pos(undefined, 4)))).toEqual(['stage 6:C'])
  })

  it('wraps to the first chorus after the last one, and starts there when nothing is up', () => {
    expect(staged(chorusActions(slides, pos(5, 5)))).toEqual(['stage 2:C'])
    expect(staged(chorusActions(slides, pos()))).toEqual(['stage 2:C'])
  })

  it('then Space sends the chorus and queues what follows it', () => {
    let s = press(initialState(), (st) => chorusActions(slides, { ...st, preview: frame(slides[2]), live: frame(slides[2]) }))
    expect(show(s)).toBe('P 4:C | L —')
    s = press(s, (st) => spaceActions(slides, st))
    expect(show(s)).toBe('P 5:B | L 4:C')
  })

  it('does nothing for items with no chorus', () => {
    const verses: Slide[] = [
      { id: 'a', kind: 'scripture', section: '3:16', text: 'x' },
      { id: 'b', kind: 'announcement', section: 'C', text: 'not a song' }
    ]
    expect(chorusActions(verses, pos())).toEqual([])
  })
})

describe('number keys', () => {
  it('map 1–9 to service positions and ignore everything else', () => {
    expect(itemIndexForKey('1')).toBe(0)
    expect(itemIndexForKey('9')).toBe(8)
    for (const k of ['0', '10', 'a', ' ', 'Enter']) expect(itemIndexForKey(k)).toBeNull()
  })
})

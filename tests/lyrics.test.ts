import { describe, expect, it } from 'vitest'
import { joinLyrics, parseArrangement, sectionName, songToItem, splitLyrics } from '../src/shared/lyrics'
import type { Song } from '../src/shared/types'

describe('splitLyrics', () => {
  it('uses header lines and keeps paste order as the arrangement', () => {
    const { sections, arrangement } = splitLyrics(`Verse 1
Amazing grace! How sweet the sound
That saved a wretch like me!

Chorus
My chains are gone

Verse 2
'Twas grace that taught my heart to fear

[Chorus]
My chains are gone

Bridge:
The earth shall soon dissolve like snow`)
    expect(sections.map((s) => s.label)).toEqual(['V1', 'C', 'V2', 'B'])
    expect(arrangement).toEqual(['V1', 'C', 'V2', 'C', 'B'])
    expect(sections[0].text).toBe('Amazing grace! How sweet the sound\nThat saved a wretch like me!')
  })

  it('numbers unlabelled stanzas as verses and spots a repeated one as the chorus', () => {
    const { sections, arrangement } = splitLyrics('first verse\nline\n\nsame chorus\n\nsecond verse\n\nsame chorus')
    expect(sections.map((s) => s.label)).toEqual(['V1', 'C', 'V2'])
    expect(arrangement).toEqual(['V1', 'C', 'V2', 'C'])
  })

  it('accepts a header on its own block and abbreviations', () => {
    const { sections } = splitLyrics('V1\n\nline one\n\nPre-Chorus\nbuild up\n\nC2\nsecond chorus')
    expect(sections.map((s) => s.label)).toEqual(['V1', 'PC', 'C2'])
  })

  it('handles Windows line endings, extra blank lines and spaces', () => {
    const { sections } = splitLyrics('  line a  \r\nline b\r\n\r\n\r\n\r\nline c\r\n')
    expect(sections).toEqual([
      { label: 'V1', text: 'line a\nline b' },
      { label: 'V2', text: 'line c' }
    ])
  })

  it('gives an empty paste no sections', () => {
    expect(splitLyrics('  \n\n ')).toEqual({ sections: [], arrangement: [] })
  })

  it('round-trips through joinLyrics', () => {
    const first = splitLyrics('Verse 1\na\n\nChorus\nb\n\nVerse 2\nc\n\nBridge\nd')
    const again = splitLyrics(joinLyrics(first.sections))
    expect(again.sections).toEqual(first.sections)
  })
})

describe('arrangement and slides', () => {
  const song: Song = {
    id: 's1',
    title: 'Test',
    author: '',
    ccli: '',
    sections: [
      { label: 'V1', text: 'one' },
      { label: 'C', text: 'chorus' },
      { label: 'V2', text: 'two' }
    ],
    arrangement: ['V1', 'C', 'V2', 'C'],
    updatedAt: 0
  }

  it('names sections for display', () => {
    expect(['V1', 'C', 'C2', 'B', 'PC', 'T'].map(sectionName)).toEqual(['Verse 1', 'Chorus', 'Chorus 2', 'Bridge', 'Pre-Chorus', 'Tag'])
  })

  it('parses a typed arrangement and drops unknown labels', () => {
    expect(parseArrangement('v1, c ,V2 C, X9', song.sections)).toEqual(['V1', 'C', 'V2', 'C'])
  })

  it('shows a chorus stored once every time it is sung', () => {
    const item = songToItem(song, 'item')
    expect(item.slides.map((s) => `${s.section}:${s.text}`)).toEqual(['V1:one', 'C:chorus', 'V2:two', 'C:chorus'])
    expect(new Set(item.slides.map((s) => s.id)).size).toBe(4)
    expect(item.slides.every((s) => s.label === undefined)).toBe(true)
  })

  it('falls back to section order with no arrangement', () => {
    expect(songToItem({ ...song, arrangement: [] }, 'i').slides.map((s) => s.section)).toEqual(['V1', 'C', 'V2'])
  })
})

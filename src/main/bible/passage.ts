// Turns verses into slides. Pure: long passages split at verse boundaries,
// sized to the theme so text fits the 1920x1080 canvas.

import { formatReference } from '../../parser/reference'
import type { ServiceItem, Slide, Theme } from '../../shared/types'

export interface Verse {
  book: number
  chapter: number
  verse: number
  text: string
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)])

/**
 * Rough characters that fit on one slide: average glyph is about half the font
 * size wide, lines are 1.25x the font size tall, and we keep 30% headroom for
 * the reference label and uneven line breaks.
 */
export function slideCharBudget(theme: Pick<Theme, 'fontSize' | 'margin'>): number {
  const perLine = (1920 - 2 * theme.margin) / (theme.fontSize * 0.5)
  const lines = (1080 - 2 * theme.margin) / (theme.fontSize * 1.25)
  return Math.max(80, Math.floor(perLine * lines * 0.7))
}

/** Groups consecutive verses so each group stays within the budget. A single long verse gets its own slide. */
export function splitVerses(verses: Verse[], budget: number): Verse[][] {
  const groups: Verse[][] = []
  let current: Verse[] = []
  let size = 0
  for (const v of verses) {
    const len = v.text.length + 4
    if (current.length > 0 && size + len > budget) {
      groups.push(current)
      current = []
      size = 0
    }
    current.push(v)
    size += len
  }
  if (current.length) groups.push(current)
  return groups
}

const refOf = (group: Verse[]) => {
  const first = group[0]
  const last = group[group.length - 1]
  return { book: first.book, chapter: first.chapter, verse: first.verse, endChapter: last.chapter, endVerse: last.verse }
}

/** Builds a scripture service item; verse numbers appear when a slide holds more than one verse. */
export function passageToItem(verses: Verse[], theme: Theme, translation: string, id: string): ServiceItem | null {
  if (verses.length === 0) return null
  const groups = splitVerses(verses, slideCharBudget(theme))
  const slides: Slide[] = groups.map((group, n) => {
    const ref = refOf(group)
    const label = `${formatReference(ref)} (${translation})`
    const text = group.length === 1 ? group[0].text : group.map((v) => `${sup(v.verse)} ${v.text}`).join(' ')
    const section = formatReference(ref).replace(/^.* (?=\d+[:\d])/, '')
    return { id: `${id}-${n + 1}`, kind: 'scripture', label, section, text }
  })
  const ref = formatReference(refOf(verses))
  return { id, kind: 'scripture', title: `${ref} (${translation})`, slides, scripture: { ref, translation } }
}

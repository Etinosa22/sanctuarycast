// Splits pasted lyrics into labelled sections and back. Pure; shared so the
// song editor can preview the split live and main can validate on save.

import type { ServiceItem, Song, SongSection } from './types'

const HEADER =
  /^\s*[[(]?\s*(verse|v|chorus|c|refrain|r|bridge|b|pre-?chorus|pc|tag|t|ending|outro|intro)\s*(\d+)?\s*[\])]?\s*[:.]?\s*$/i

const BASE: Record<string, string> = {
  verse: 'V', v: 'V', chorus: 'C', c: 'C', refrain: 'C', r: 'C', bridge: 'B', b: 'B',
  prechorus: 'PC', 'pre-chorus': 'PC', pc: 'PC', tag: 'T', t: 'T', ending: 'E', outro: 'E', intro: 'I'
}
const NAMES: Record<string, string> = { V: 'Verse', C: 'Chorus', B: 'Bridge', PC: 'Pre-Chorus', T: 'Tag', E: 'Ending', I: 'Intro' }

const tidy = (s: string) => s.split('\n').map((l) => l.trim()).join('\n').trim()

/** "V1" -> "Verse 1", "C" -> "Chorus", "C2" -> "Chorus 2". */
export function sectionName(label: string): string {
  const m = label.match(/^([A-Z]+)(\d*)$/)
  if (!m) return label
  return `${NAMES[m[1]] ?? m[1]}${m[2] ? ` ${m[2]}` : ''}`
}

/**
 * Stanzas are separated by blank lines. A header line ("Verse 2", "[Chorus]",
 * "Bridge:") labels the stanza under it. Unlabelled stanzas become verses,
 * except one that appears more than once, which is taken to be the chorus.
 * The arrangement follows the order stanzas appear in the paste.
 */
export function splitLyrics(raw: string): { sections: SongSection[]; arrangement: string[] } {
  const blocks = raw
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n'))
    .filter((lines) => lines.some((l) => l.trim()))

  // Pull out headers; a header alone in its block labels the next block.
  const stanzas: { header?: { base: string; n?: number }; text: string }[] = []
  let pending: { base: string; n?: number } | undefined
  for (const lines of blocks) {
    const m = lines[0].match(HEADER)
    const header = m ? { base: BASE[m[1].toLowerCase().replace(/\s/g, '')] ?? 'V', n: m[2] ? Number(m[2]) : undefined } : undefined
    const body = tidy((header ? lines.slice(1) : lines).join('\n'))
    if (header && !body) {
      pending = header
      continue
    }
    stanzas.push({ header: header ?? pending, text: body })
    pending = undefined
  }

  const counts = new Map<string, number>()
  for (const s of stanzas) counts.set(s.text, (counts.get(s.text) ?? 0) + 1)
  const hasChorus = stanzas.some((s) => s.header?.base === 'C')

  const sections: SongSection[] = []
  const arrangement: string[] = []
  const labelOfText = new Map<string, string>()
  const nextNumber = new Map<string, number>()

  for (const s of stanzas) {
    const known = labelOfText.get(s.text)
    if (known) {
      arrangement.push(known)
      continue
    }
    let label: string
    if (s.header) {
      const base = s.header.base
      const n = s.header.n ?? (base === 'V' ? (nextNumber.get('V') ?? 0) + 1 : undefined)
      if (n !== undefined) nextNumber.set(base, Math.max(nextNumber.get(base) ?? 0, n))
      label = base === 'V' ? `V${n}` : n && n > 1 ? `${base}${n}` : base
      if (sections.some((x) => x.label === label)) label = `${label}-${sections.length + 1}`
    } else if (!hasChorus && (counts.get(s.text) ?? 0) > 1 && !sections.some((x) => x.label === 'C')) {
      label = 'C'
    } else {
      const n = (nextNumber.get('V') ?? 0) + 1
      nextNumber.set('V', n)
      label = `V${n}`
    }
    sections.push({ label, text: s.text })
    labelOfText.set(s.text, label)
    arrangement.push(label)
  }
  return { sections, arrangement }
}

/** Rebuilds editable lyrics with headers, for the song editor. */
export function joinLyrics(sections: SongSection[]): string {
  return sections.map((s) => `${sectionName(s.label)}\n${s.text}`).join('\n\n')
}

/** "V1, C ,v2" -> ["V1","C","V2"], keeping only labels the song has. */
export function parseArrangement(text: string, sections: SongSection[]): string[] {
  const labels = new Set(sections.map((s) => s.label))
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => labels.has(t))
}

/** One slide per arrangement entry, so a chorus stored once shows each time it is sung. */
export function songToItem(song: Song, itemId: string): ServiceItem {
  const byLabel = new Map(song.sections.map((s) => [s.label, s]))
  const order = song.arrangement.length ? song.arrangement : song.sections.map((s) => s.label)
  const slides = order
    .map((label) => byLabel.get(label))
    .filter((s): s is SongSection => Boolean(s))
    .map((s, n) => ({ id: `${itemId}-${n + 1}`, kind: 'song' as const, section: s.label, text: s.text }))
  return { id: itemId, kind: 'song', title: song.title, slides }
}

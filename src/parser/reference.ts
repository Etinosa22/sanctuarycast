// Parses typed scripture references: "John 5:10", "jn 3 16", "1cor13:4-7",
// "Psalm 23", "I John 1:9", "John 3:16-4:2", "Jude 5". Pure, no Electron imports.
// Spoken forms ("John three sixteen") come in Phase 2.

import { BOOKS, bookById, compact, findBook, type BookInfo } from './books'

export interface ScriptureRef {
  book: number
  chapter: number
  /** Omitted for a whole chapter ("Psalm 23"). */
  verse?: number
  endChapter?: number
  endVerse?: number
}

const ORDINALS: Record<string, string> = {
  i: '1', ii: '2', iii: '3', first: '1', second: '2', third: '3', '1st': '1', '2nd': '2', '3rd': '3'
}

// [book words] [chapter] ([:. ] [verse] (- [verse or chapter:verse])?)?
const REF = /^(.*?[a-z])\s*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*-\s*(\d+)(?:\s*:\s*(\d+))?)?)?$/

function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‐-―]/g, '-') // en/em dashes
    .replace(/\s*(?:–|—|to|through|thru)\s*(?=\d)/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function bookFrom(words: string): BookInfo | null {
  const m = words.trim().match(/^(i{1,3}|first|second|third|1st|2nd|3rd)\s+(.+)$/)
  const key = m ? ORDINALS[m[1]] + compact(m[2]) : compact(words)
  return findBook(key)
}

export function parseReference(input: string): ScriptureRef | null {
  const m = normalise(input).match(REF)
  if (!m) return null
  const book = bookFrom(m[1])
  if (!book) return null
  const a = Number(m[2])
  const b = m[3] !== undefined ? Number(m[3]) : undefined
  const c = m[4] !== undefined ? Number(m[4]) : undefined
  const d = m[5] !== undefined ? Number(m[5]) : undefined

  let ref: ScriptureRef
  if (book.chapters === 1 && b === undefined) {
    // "Jude 5" means verse 5 of the only chapter.
    ref = { book: book.id, chapter: 1, verse: a }
  } else {
    ref = { book: book.id, chapter: a, verse: b }
    if (c !== undefined && d !== undefined) ref = { ...ref, endChapter: c, endVerse: d }
    else if (c !== undefined) ref = { ...ref, endVerse: c }
  }
  return isValid(ref, book) ? ref : null
}

function isValid(r: ScriptureRef, book: BookInfo): boolean {
  if (r.chapter < 1 || r.chapter > book.chapters) return false
  if (r.verse !== undefined && r.verse < 1) return false
  const endCh = r.endChapter ?? r.chapter
  if (endCh < r.chapter || endCh > book.chapters) return false
  if (r.endVerse !== undefined && endCh === r.chapter && r.verse !== undefined && r.endVerse < r.verse) return false
  return true
}

/** "John 3:16–17", "Psalm 23", "John 3:16–4:2". Uses an en dash for ranges. */
export function formatReference(r: ScriptureRef): string {
  const book = bookById(r.book)!
  const name = book.refName
  if (r.verse === undefined) return `${name} ${r.chapter}`
  const start = `${name} ${r.chapter}:${r.verse}`
  if (r.endChapter !== undefined && r.endChapter !== r.chapter) return `${start}–${r.endChapter}:${r.endVerse}`
  if (r.endVerse !== undefined && r.endVerse !== r.verse) return `${start}–${r.endVerse}`
  return start
}

export { BOOKS }

/** Book id for a name as written in an imported file ("I Samuel", "1 Sam", "Revelation of John"), or null. */
export function bookIdFromName(name: string): number | null {
  return bookFrom(name.toLowerCase().replace(/\s+/g, ' ').trim())?.id ?? null
}

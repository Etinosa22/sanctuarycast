// Finds scripture references in spoken sermon text, as transcribed by whisper:
// "John 3:16", "Philippians 4-13", "Romans 8, 28", "1 Corinthians 13 verses 4 to 7",
// "John three sixteen", "the book of First Corinthians chapter thirteen",
// and "verse eight" / "go down to verse twelve" using the current chapter.
// Pure TypeScript, no Electron imports.

import { BOOKS, compact, type BookInfo } from './books'
import type { ScriptureRef } from './reference'

export interface SpokenContext {
  book: number
  chapter: number
}

export interface Detection {
  ref: ScriptureRef
  /** high: said "chapter"/"verse" or used a colon; medium: bare numbers after a book name. */
  confidence: 'high' | 'medium'
  /** 'context' when only a verse was said and the book/chapter came from what went before. */
  source: 'explicit' | 'context'
  /** The words that matched, for the suggestion card. */
  heard: string
  /** Nothing but punctuation follows it: audio may have been cut mid-number ("twenty" of "twenty-eight"). */
  atEnd: boolean
}

// ---- number words -> digits ----

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ORDINAL_BOOK: Record<string, string> = { first: '1', '1st': '1', second: '2', '2nd': '2', third: '3', '3rd': '3' }

/** Turns "one hundred and nineteen" -> "119", "twenty one" -> "21"; leaves "three sixteen" as "3 16". */
function numberWordsToDigits(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i]
    const startsNumber = t in ONES || t in TENS || ((t === 'a' || t === 'one') && tokens[i + 1] === 'hundred')
    if (!startsNumber) {
      out.push(t)
      i++
      continue
    }
    let value = 0
    let j = i
    if ((tokens[j] === 'a' || tokens[j] in ONES) && tokens[j + 1] === 'hundred') {
      value = (tokens[j] === 'a' ? 1 : ONES[tokens[j]]) * 100
      j += 2
      if (tokens[j] === 'and') j++
    }
    if (tokens[j] in TENS) {
      value += TENS[tokens[j]]
      j++
      if (tokens[j] in ONES && ONES[tokens[j]] > 0 && ONES[tokens[j]] < 10) value += ONES[tokens[j++]]
    } else if (tokens[j] in ONES) {
      value += ONES[tokens[j++]]
    } else if (value > 0 && tokens[j - 1] === 'and') {
      j-- // "a hundred and" followed by a non-number: give "and" back
    }
    out.push(String(value))
    i = j
  }
  return out
}

function tokenise(text: string): string[] {
  const s = text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[‐-―]/g, '-')
    // "twenty-one" is one number; "4-13" is chapter-verse.
    .replace(/\b(twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/g, '$1 $2')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1$2 ')
    // Whisper often writes chapter.verse: "Lamentations 3.22", "First Peter 5.7".
    .replace(/(\d)\.(\d)/g, '$1:$2')
    .replace(/([:,\-])/g, ' $1 ')
    .replace(/[.!?;]+/g, ' . ')
    .replace(/[^a-z0-9:,\-. ]+/g, ' ')
  return numberWordsToDigits(s.split(/\s+/).filter(Boolean))
}

// ---- book names as people say them ----

const SPOKEN_EXTRA: Record<string, string[]> = {
  Psalms: ['psalm', 'psalms'],
  'Song of Solomon': ['songofsongs', 'songofsolomon', 'song'],
  Revelation: ['revelation', 'revelations'],
  Acts: ['acts', 'actsoftheapostles']
}
/** Books whose names are everyday words: need "chapter"/"verse" or a colon to count. */
const COMMON_WORDS = new Set(['Job', 'Mark', 'Acts', 'Numbers', 'Judges', 'Ruth', 'James', 'Song of Solomon', 'Amos', 'Titus'])

const spokenBook = new Map<string, BookInfo>()
for (const b of BOOKS) {
  spokenBook.set(compact(b.name), b)
  spokenBook.set(compact(b.refName), b)
  for (const extra of SPOKEN_EXTRA[b.name] ?? []) spokenBook.set(extra, b)
}

const isNum = (t: string | undefined): t is string => t !== undefined && /^\d+$/.test(t)

/** Longest chapter in the Bible is Psalm 119 with 176 verses. */
const MAX_VERSE = 176

/**
 * Whisper sometimes runs chapter and verse together: "Romans 828", "John 316".
 * If the number can't be a chapter of this book, split it into chapter:verse,
 * preferring the longest valid chapter ("Romans 1213" -> 12:13).
 */
function splitRunTogether(token: string, book: BookInfo): { chapter: number; verse: number } | null {
  if (token.length < 3 || token.length > 5 || Number(token) <= book.chapters) return null
  for (let cut = Math.min(3, token.length - 1); cut >= 1; cut--) {
    const verseDigits = token.slice(cut)
    if (verseDigits.startsWith('0')) continue
    const chapter = Number(token.slice(0, cut))
    const verse = Number(verseDigits)
    if (chapter >= 1 && chapter <= book.chapters && verse >= 1 && verse <= MAX_VERSE) return { chapter, verse }
  }
  return null
}

interface BookMatch {
  book: BookInfo
  end: number
  /** Matched a near-miss spelling ("Zeppaniah", "Hebrew"), not the name itself. */
  fuzzy: boolean
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/**
 * Whisper misspells unusual names: "Zeppaniah", "Zeffaniah", "Blamentations",
 * "Hebrew", "2nd Cesalonians". Accept a single word within 1 edit (5+ letters),
 * 2 edits (8+) or 3 edits (11+) of exactly one book name. Callers only use this
 * when a chapter and verse follow, so ordinary words ("generous 3 times") don't
 * become books.
 */
function nearBook(key: string): BookInfo | null {
  if (key.replace(/^\d/, '').length < 5) return null
  const limit = key.length >= 11 ? 3 : key.length >= 8 ? 2 : 1
  let best: BookInfo | null = null
  let bestDist = Infinity
  let tie = false
  for (const [name, book] of spokenBook) {
    if (Math.abs(name.length - key.length) > limit) continue
    const d = editDistance(key, name)
    if (d < bestDist) (best = book), (bestDist = d), (tie = false)
    else if (d === bestDist && book !== best) tie = true
  }
  return best && bestDist <= limit && !tie ? best : null
}

/** Longest book name starting at token i, with an optional "first/1st/1" prefix and "the book of". */
function bookAt(tokens: string[], i: number): BookMatch | null {
  let j = i
  if (tokens[j] === 'the' && tokens[j + 1] === 'book' && tokens[j + 2] === 'of') j += 3
  const prefix = ORDINAL_BOOK[tokens[j]] ?? (['1', '2', '3'].includes(tokens[j]) ? tokens[j] : '')
  for (const start of prefix ? [j + 1, j] : [j]) {
    for (let len = 4; len >= 1; len--) {
      const words = tokens.slice(start, start + len)
      if (words.length < len || words.some((w) => !/^[a-z]+$/.test(w))) continue
      const key = (start === j + 1 ? prefix : '') + words.join('')
      const book = spokenBook.get(key)
      if (book) return { book, end: start + len, fuzzy: false }
    }
  }
  // Near-miss spelling of a one-word name ("2nd Cesalonians" too), only right before a number.
  const w = prefix ? j + 1 : j
  const word = tokens[w]
  if (word && /^[a-z]+$/.test(word) && isNum(tokens[w + 1])) {
    const book = nearBook(prefix + word) ?? (prefix ? null : nearBook(word))
    if (book) return { book, end: w + 1, fuzzy: true }
  }
  return null
}

const RANGE_WORDS = new Set(['to', 'through', 'thru', 'till', 'until', '-', 'and'])
const VERSE_WORDS = new Set(['verse', 'verses', 'vs', 'v'])
const CHAPTER_WORDS = new Set(['chapter', 'chapters', 'chap'])

/** Reads "[chapter] N [: | , | - | verse(s)] M [to K]" from token i. */
function readNumbers(tokens: string[], i: number) {
  let j = i
  let saidChapter = false
  let saidVerse = false
  let colon = false
  if (CHAPTER_WORDS.has(tokens[j])) {
    saidChapter = true
    j++
  }
  if (!isNum(tokens[j])) return null
  const chapter = Number(tokens[j++])
  let verse: number | undefined
  let endVerse: number | undefined
  const sep = tokens[j]
  if (sep === ':' || sep === ',' || sep === '-' || VERSE_WORDS.has(sep ?? '')) {
    if (sep === ':') colon = true
    if (VERSE_WORDS.has(sep)) saidVerse = true
    let k = j + 1
    if (sep === ',' && VERSE_WORDS.has(tokens[k])) (saidVerse = true), k++
    if (isNum(tokens[k])) {
      verse = Number(tokens[k])
      j = k + 1
    }
  } else if (isNum(sep)) {
    // "John 3 16" / "John three sixteen"
    verse = Number(sep)
    j++
  }
  if (verse !== undefined && RANGE_WORDS.has(tokens[j]) && isNum(tokens[j + 1])) {
    const k = Number(tokens[j + 1])
    if (k > verse) {
      endVerse = k
      j += 2
    }
  }
  return { chapter, verse, endVerse, end: j, saidChapter, saidVerse, colon }
}

/** "verse 8", "verses 4 to 7", "go down to verse twelve" with no book: uses the context. */
function readVerseOnly(tokens: string[], i: number) {
  if (!VERSE_WORDS.has(tokens[i]) || !isNum(tokens[i + 1])) return null
  // "13 verses 4 to 7": a chapter was said, so its book was cut off; don't guess it.
  if (isNum(tokens[i - 1])) return null
  const verse = Number(tokens[i + 1])
  let j = i + 2
  let endVerse: number | undefined
  if (RANGE_WORDS.has(tokens[j]) && isNum(tokens[j + 1]) && Number(tokens[j + 1]) > verse) {
    endVerse = Number(tokens[j + 1])
    j += 2
  }
  return { verse, endVerse, end: j }
}

export function detectReferences(text: string, context: SpokenContext | null = null): { detections: Detection[]; context: SpokenContext | null } {
  const tokens = tokenise(text)
  // Index of the last real word; a reference reaching it may have been cut off.
  let lastWord = tokens.length - 1
  while (lastWord >= 0 && (tokens[lastWord] === '.' || tokens[lastWord] === ',')) lastWord--
  const detections: Detection[] = []
  let ctx = context

  for (let i = 0; i < tokens.length; i++) {
    const m = bookAt(tokens, i)
    // Speakers (and whisper) often pause after the book: "the Book of John, chapter 3".
    if (m && tokens[m.end] === ',') m.end++
    if (m && m.book.chapters === 1) {
      // "Jude, verse 24" / "third John verse two": one-chapter books go straight to the verse.
      const v = readVerseOnly(tokens, m.end)
      if (v) {
        detections.push({
          ref: { book: m.book.id, chapter: 1, verse: v.verse, endVerse: v.endVerse },
          confidence: 'high',
          source: 'explicit',
          heard: tokens.slice(i, v.end).join(' '),
          atEnd: v.end > lastWord
        })
        ctx = { book: m.book.id, chapter: 1 }
        i = v.end - 1
        continue
      }
    }
    if (m) {
      const n = readNumbers(tokens, m.end)
      if (n) {
        const book = m.book
        let ref: ScriptureRef
        const joined = n.verse === undefined && book.chapters > 1 ? splitRunTogether(tokens[n.end - 1], book) : null
        if (joined) ref = { book: book.id, chapter: joined.chapter, verse: joined.verse }
        else if (book.chapters === 1 && n.verse === undefined && !n.saidChapter) ref = { book: book.id, chapter: 1, verse: n.chapter }
        else ref = { book: book.id, chapter: n.chapter, verse: n.verse, endVerse: n.endVerse }
        const explicit = n.saidChapter || n.saidVerse || n.colon
        const valid = ref.chapter >= 1 && ref.chapter <= book.chapters && (ref.verse === undefined || ref.verse >= 1)
        // Everyday-word books ("mark", "job") need clear wording, not just numbers after them;
        // a near-miss spelling needs a verse as well as a chapter.
        const clearEnough = (!COMMON_WORDS.has(book.name) || explicit) && (!m.fuzzy || ref.verse !== undefined)
        if (valid && clearEnough) {
          detections.push({
            ref,
            // A guessed spelling is never sure enough for Auto Live.
            confidence: !m.fuzzy && (explicit || ref.verse !== undefined) ? 'high' : 'medium',
            source: 'explicit',
            heard: tokens.slice(i, n.end).join(' ').replace(/ ([:,-]) /g, '$1 ').replace(/ :/g, ':'),
            atEnd: n.end > lastWord
          })
          ctx = { book: ref.book, chapter: ref.chapter }
          i = n.end - 1
          continue
        }
      }
    }

    // "chapter 5 verse 3" with no book, or "verse 8" alone: lean on what was said before.
    if (ctx && CHAPTER_WORDS.has(tokens[i]) && isNum(tokens[i + 1])) {
      const n = readNumbers(tokens, i)
      const book = BOOKS[ctx.book - 1]
      if (n && n.verse !== undefined && n.chapter <= book.chapters) {
        detections.push({
          ref: { book: ctx.book, chapter: n.chapter, verse: n.verse, endVerse: n.endVerse },
          confidence: 'high',
          source: 'context',
          heard: tokens.slice(i, n.end).join(' '),
          atEnd: n.end > lastWord
        })
        ctx = { book: ctx.book, chapter: n.chapter }
        i = n.end - 1
        continue
      }
    }
    if (ctx) {
      const v = readVerseOnly(tokens, i)
      if (v) {
        detections.push({
          ref: { book: ctx.book, chapter: ctx.chapter, verse: v.verse, endVerse: v.endVerse },
          confidence: 'high',
          source: 'context',
          heard: tokens.slice(i, v.end).join(' '),
          atEnd: v.end > lastWord
        })
        i = v.end - 1
      }
    }
  }
  return { detections, context: ctx }
}

// Recognises a verse from its words when the preacher recites it without the
// reference ("For God so loved the world, that he gave his only begotten Son").
// Pure: the caller supplies candidate verses (from full-text search); this
// scores them by the longest run of words said in the same order as the verse.

export interface QuoteCandidate {
  book: number
  chapter: number
  verse: number
  text: string
}

export interface QuoteMatch {
  candidate: QuoteCandidate
  /** Longest run of words said in the verse's own order. */
  run: number
  /** Share of the verse that run covers. */
  coverage: number
  confidence: 'high' | 'medium'
  /** The matched words as heard, for the card. */
  heard: string
}

export const STOPWORDS = new Set(
  ('a an and are as at be but by for from had has have he her him his i in is it its me my not of on or our she so ' +
    'that the their them then there they this to was we were what when which who will with you your all also am do did unto ' +
    'shall thee thou thy ye hath doth upon let us yea o')
    .split(' ')
)

// Old forms the KJV uses and preachers often modernise.
const SAME_AS: Record<string, string> = {
  thee: 'you', thou: 'you', ye: 'you', thy: 'your', thine: 'your', hath: 'has', doth: 'does', unto: 'to', shalt: 'shall', wilt: 'will', saith: 'says'
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

/** Rough stem so "believeth", "believes" and "believed" compare equal. */
function stem(w: string): string {
  const s = SAME_AS[w] ?? w
  return s.length > 4 ? s.replace(/(eth|est|ing|ed|es|s|e)$/, '') : s.length > 3 ? s.replace(/(s|e)$/, '') : s
}

/** Content words worth searching for: no stopwords, no numbers, at least 3 letters. */
export function searchWords(text: string): string[] {
  return [...new Set(words(text).filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)))]
}

/** Longest run of consecutive words shared by a and b (on stems); returns its length and where it ends in a. */
function longestRun(a: string[], b: string[]): { len: number; endA: number } {
  let best = { len: 0, endA: 0 }
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1
        if (cur[j] > best.len) best = { len: cur[j], endA: i }
      }
    }
    prev = cur
  }
  return best
}

/** A run must be this long, with at least this many content words, to count as a quote. */
export const MIN_RUN = 6
const MIN_CONTENT = 3

export function bestQuoteMatch(transcript: string, candidates: QuoteCandidate[]): QuoteMatch | null {
  const heardWords = words(transcript)
  const heardStems = heardWords.map(stem)
  let best: QuoteMatch | null = null
  for (const c of candidates) {
    const verseStems = words(c.text).map(stem)
    if (verseStems.length < MIN_RUN) continue // too short to tell apart from ordinary speech
    const { len, endA } = longestRun(heardStems, verseStems)
    if (len < MIN_RUN) continue
    const runWords = heardWords.slice(endA - len, endA)
    if (runWords.filter((w) => !STOPWORDS.has(w)).length < MIN_CONTENT) continue
    const coverage = len / verseStems.length
    const confidence = len >= 8 || coverage >= 0.6 ? 'high' : 'medium'
    if (!best || len > best.run || (len === best.run && coverage > best.coverage)) {
      best = { candidate: c, run: len, coverage, confidence, heard: runWords.join(' ') }
    }
  }
  return best
}

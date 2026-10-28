// Turns a stream of transcript chunks into scripture suggestions. Pure: no
// Electron, no audio. Audio arrives in overlapping windows, so the same words
// are heard more than once; each reference is suggested once per window.

import { formatReference, type ScriptureRef } from '../parser/reference'
import { detectReferences, type Detection, type SpokenContext } from '../parser/spoken'

export interface DetectedSuggestion {
  /** Formatted reference, e.g. "John 3:16"; also the de-duplication key. */
  key: string
  ref: ScriptureRef
  confidence: Detection['confidence']
  source: Detection['source']
  heard: string
  at: number
  /** A chapter-only suggestion this one makes redundant ("John 3" -> "John 3:16"). */
  replaces?: string
}

/**
 * Whisper sometimes repeats a phrase over and over ("go down to verse 18. And
 * then go down to verse 18."). Drops any run of 3+ words that immediately
 * repeats, so a loop can't invent context or extra references.
 */
export function collapseRepeats(text: string): string {
  const words = text.split(/\s+/).filter(Boolean)
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (let size = Math.floor(words.length / 2); size >= 3; size--) {
    for (let i = 0; i + 2 * size <= words.length; i++) {
      let same = true
      for (let k = 0; k < size && same; k++) same = norm(words[i + k]) === norm(words[i + size + k])
      if (same) return collapseRepeats([...words.slice(0, i + size), ...words.slice(i + 2 * size)].join(' '))
    }
  }
  return words.join(' ')
}

/** How long a reference heard at the very end of a chunk waits for the next chunk to confirm it. */
const PENDING_MS = 8_000

export class ReferenceDetector {
  private context: SpokenContext | null = null
  private recent = new Map<string, number>()
  private pending = new Map<string, number>()

  constructor(
    private clock: () => number = Date.now,
    /** A reference heard again within this time is not suggested again. */
    private repeatWindowMs = 45_000
  ) {}

  get currentContext(): SpokenContext | null {
    return this.context
  }

  /** E.g. from what is on Live, so "verse eight" means that chapter. */
  setContext(ctx: SpokenContext | null): void {
    this.context = ctx
  }

  reset(): void {
    this.context = null
    this.recent.clear()
    this.pending.clear()
  }

  /**
   * `complete` is for typed text: nothing can have been cut off. For audio, a
   * reference at the very end of a chunk ("Romans 8 20" from a cut "twenty-eight")
   * is held until the next overlapping chunk hears it again or hears it continue.
   */
  feed(text: string, { complete = false }: { complete?: boolean } = {}): DetectedSuggestion[] {
    const now = this.clock()
    for (const [k, t] of this.recent) if (now - t > this.repeatWindowMs) this.recent.delete(k)
    for (const [k, t] of this.pending) if (now - t > PENDING_MS) this.pending.delete(k)

    const { detections, context } = detectReferences(complete ? text : collapseRepeats(text), this.context)
    this.context = context
    const out: DetectedSuggestion[] = []
    for (const d of detections) {
      const key = formatReference(d.ref)
      if (this.recent.has(key)) continue
      if (d.atEnd && !complete && !this.pending.has(key)) {
        this.pending.set(key, now)
        continue
      }
      this.pending.delete(key)
      this.recent.set(key, now)
      const chapterKey = formatReference({ book: d.ref.book, chapter: d.ref.chapter })
      const replaces = d.ref.verse !== undefined && this.recent.has(chapterKey) ? chapterKey : undefined
      out.push({ key, ref: d.ref, confidence: d.confidence, source: d.source, heard: d.heard, at: now, replaces })
    }
    return out
  }
}

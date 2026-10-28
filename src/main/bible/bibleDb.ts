// Read-only access to one translation's SQLite file (resources/bibles/<code>.sqlite).
// Copyrighted translations are never bundled; a licensed copy the church
// imports later uses this same schema.

import { DatabaseSync } from 'node:sqlite'
import type { ScriptureRef } from '../../parser/reference'
import type { Verse } from './passage'

export interface TranslationInfo {
  code: string
  name: string
  licence: string
}

export class BibleDb {
  private db: DatabaseSync
  readonly info: TranslationInfo

  constructor(file: string) {
    this.db = new DatabaseSync(file, { readOnly: true })
    const meta = Object.fromEntries(
      (this.db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value])
    )
    this.info = { code: meta.code ?? '?', name: meta.name ?? 'Unknown', licence: meta.licence ?? 'unknown' }
  }

  lastVerse(book: number, chapter: number): number {
    const row = this.db.prepare('SELECT MAX(verse) AS v FROM verses WHERE book = ? AND chapter = ?').get(book, chapter) as { v: number | null }
    return row.v ?? 0
  }

  /** Verses for a reference; ranges past the end of a chapter are clamped. */
  passage(ref: ScriptureRef): Verse[] {
    const startVerse = ref.verse ?? 1
    const endChapter = ref.endChapter ?? ref.chapter
    let endVerse: number
    if (ref.verse === undefined) endVerse = this.lastVerse(ref.book, ref.chapter)
    else if (ref.endVerse === undefined) endVerse = startVerse
    else endVerse = Math.min(ref.endVerse, this.lastVerse(ref.book, endChapter))
    return this.db
      .prepare(
        `SELECT book, chapter, verse, text FROM verses
         WHERE book = ? AND (chapter * 1000 + verse) BETWEEN ? AND ?
         ORDER BY chapter, verse`
      )
      .all(ref.book, ref.chapter * 1000 + startVerse, endChapter * 1000 + endVerse) as unknown as Verse[]
  }

  /** Keyword search: every word must appear. Best matches first. */
  search(query: string, limit = 20): Verse[] {
    const words = query.toLowerCase().match(/[a-z']+/g)
    if (!words || words.length === 0) return []
    // Quote each word so FTS5 operators in user input are treated as text.
    const match = words.map((w) => `"${w.replace(/"/g, '')}"`).join(' ')
    return this.db
      .prepare(
        `SELECT v.book, v.chapter, v.verse, v.text FROM verses_fts f
         JOIN verses v ON v.rowid = f.rowid
         WHERE verses_fts MATCH ? ORDER BY rank LIMIT ?`
      )
      .all(match, limit) as unknown as Verse[]
  }

  /** Verses containing any of these words, best first: candidates for quote matching. */
  candidates(words: string[], limit = 25): Verse[] {
    const clean = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean)
    if (clean.length === 0) return []
    const match = clean.map((w) => `"${w}"`).join(' OR ')
    return this.db
      .prepare(
        `SELECT v.book, v.chapter, v.verse, v.text FROM verses_fts f
         JOIN verses v ON v.rowid = f.rowid
         WHERE verses_fts MATCH ? ORDER BY rank LIMIT ?`
      )
      .all(match, limit) as unknown as Verse[]
  }

  close(): void {
    this.db.close()
  }
}

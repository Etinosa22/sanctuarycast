// Builds a translation file (resources/bibles/<code>.sqlite or the church's own
// imports folder) from a CSV of Book,Chapter,Verse,Text or from a SQLite file in
// our schema. Self-contained (node: modules only) so scripts/build-bible.ts can
// run it with plain Node.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface TranslationMeta {
  code: string
  name: string
  language: string
  /** 'public-domain' ships with the app; 'licensed' is a church import, never bundled. */
  licence: 'public-domain' | 'licensed'
  source: string
}

/** Maps a book name from the file to 1–66, or null if unknown. */
export type BookResolver = (name: string) => number | null

/** Minimal RFC 4180 parser: quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let i = 0
  while (i < text.length) {
    const row: string[] = []
    for (;;) {
      let field = ''
      if (text[i] === '"') {
        i++
        for (;;) {
          if (i >= text.length) break
          if (text[i] === '"' && text[i + 1] === '"') {
            field += '"'
            i += 2
          } else if (text[i] === '"') {
            i++
            break
          } else field += text[i++]
        }
      } else {
        while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') field += text[i++]
      }
      row.push(field)
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === '\r') i++
      if (text[i] === '\n') i++
      break
    }
    if (!(row.length === 1 && row[0] === '')) rows.push(row)
  }
  return rows
}

interface VerseRow {
  book: number
  chapter: number
  verse: number
  text: string
}

/**
 * Turns CSV rows into verses. Book names are resolved by name first; if any is
 * unknown but the file has exactly 66 books, they are numbered in file order.
 */
export function versesFromCsv(rows: string[][], resolve: BookResolver): VerseRow[] {
  const body = rows.length && !/^\d+$/.test(rows[0][1] ?? '') ? rows.slice(1) : rows
  if (body.length === 0) throw new Error('The file has no verses')
  for (const [n, r] of body.entries()) {
    if (r.length < 4 || !/^\d+$/.test(r[1]) || !/^\d+$/.test(r[2])) {
      throw new Error(`Row ${n + 2} is not "Book,Chapter,Verse,Text": ${r.slice(0, 4).join(',').slice(0, 80)}`)
    }
  }
  const names = [...new Set(body.map((r) => r[0]))]
  let idOf = new Map<string, number>()
  const byName = names.map((n) => (/^\d+$/.test(n) ? Number(n) : resolve(n)))
  if (byName.every((id) => id !== null && id >= 1 && id <= 66) && new Set(byName).size === names.length) {
    names.forEach((n, i) => idOf.set(n, byName[i]!))
  } else if (names.length === 66) {
    idOf = new Map(names.map((n, i) => [n, i + 1]))
  } else {
    const unknown = names.filter((_, i) => byName[i] === null).slice(0, 5)
    throw new Error(`Unrecognised book names: ${unknown.join(', ')}`)
  }
  // Some sources mark italics or "Selah" with [brackets]; project the words plain.
  return body.map((r) => ({
    book: idOf.get(r[0])!,
    chapter: Number(r[1]),
    verse: Number(r[2]),
    text: r.slice(3).join(',').replace(/[[\]]/g, '').trim()
  }))
}

/** Reads verses out of a SQLite file that uses our schema (e.g. one exported from another SanctuaryCast). */
export function versesFromSqlite(file: string): VerseRow[] {
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    return db.prepare('SELECT book, chapter, verse, text FROM verses ORDER BY book, chapter, verse').all() as unknown as VerseRow[]
  } catch {
    throw new Error('This SQLite file has no "verses" table with book, chapter, verse and text columns')
  } finally {
    db.close()
  }
}

/** Writes a translation file with full-text search. Replaces any existing file at `out`. */
export function writeBible(out: string, meta: TranslationMeta, verses: VerseRow[]): number {
  const valid = verses.filter((v) => v.book >= 1 && v.book <= 66 && v.chapter >= 1 && v.verse >= 1 && v.text)
  if (valid.length < 100) throw new Error(`Only ${valid.length} usable verses found; is this a Bible file?`)
  const tmp = `${out}.building`
  if (existsSync(tmp)) rmSync(tmp)
  mkdirSync(dirname(out), { recursive: true })
  const db = new DatabaseSync(tmp)
  try {
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE verses (book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL,
                           PRIMARY KEY (book, chapter, verse));
      CREATE VIRTUAL TABLE verses_fts USING fts5(text, content='verses', content_rowid='rowid', tokenize='porter unicode61');
    `)
    const m = db.prepare('INSERT INTO meta VALUES (?, ?)')
    for (const [k, v] of Object.entries(meta)) m.run(k, v)
    const ins = db.prepare('INSERT OR REPLACE INTO verses (book, chapter, verse, text) VALUES (?, ?, ?, ?)')
    db.exec('BEGIN')
    for (const v of valid) ins.run(v.book, v.chapter, v.verse, v.text)
    db.exec('COMMIT')
    db.exec("INSERT INTO verses_fts(verses_fts) VALUES ('rebuild')")
    db.exec('VACUUM')
  } finally {
    db.close()
  }
  // Only replace the real file once the new one is complete.
  if (existsSync(out)) rmSync(out)
  renameSync(tmp, out)
  return valid.length
}

export function buildFromCsvFile(csvFile: string, out: string, meta: TranslationMeta, resolve: BookResolver = () => null): number {
  return writeBible(out, meta, versesFromCsv(parseCsv(readFileSync(csvFile, 'utf8')), resolve))
}

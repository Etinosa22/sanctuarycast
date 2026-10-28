// The church's own library (songs, imported backgrounds) in one SQLite file
// in the app's data folder. Writes are immediate; WAL keeps them crash-safe.

import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Background, LibraryBackground, SavedTheme, Song, SongInput, SongSummary, Theme } from '../../shared/types'
import { DEFAULT_THEME } from '../engine/presentationEngine'
import { isPartialTheme } from '../engine/validate'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '',
    ccli_number TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS song_sections (
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    ord INTEGER NOT NULL, label TEXT NOT NULL, text TEXT NOT NULL,
    PRIMARY KEY (song_id, ord));
  CREATE TABLE IF NOT EXISTS song_arrangements (
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    name TEXT NOT NULL, sequence TEXT NOT NULL,
    PRIMARY KEY (song_id, name));
  CREATE TABLE IF NOT EXISTS backgrounds (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('colour','image','video')),
    name TEXT NOT NULL, file TEXT, colour TEXT, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS songs_title ON songs(title COLLATE NOCASE);
  CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
`

const toBackground = (r: { kind: string; file: string | null; colour: string | null }): Background =>
  r.kind === 'colour' ? { kind: 'colour', colour: r.colour ?? '#000' } : { kind: r.kind as 'image' | 'video', file: r.file ?? '' }

export class Library {
  private db: DatabaseSync

  constructor(file: string, private clock: () => number = Date.now) {
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;')
    this.db.exec(SCHEMA)
  }

  /** Runs once per library file, e.g. to add the public-domain starter hymns. */
  seedOnce(key: string, seed: () => void): void {
    if (this.db.prepare('SELECT 1 FROM meta WHERE key = ?').get(key)) return
    seed()
    this.db.prepare('INSERT INTO meta VALUES (?, ?)').run(key, String(this.clock()))
  }

  // ---- songs ----

  listSongs(filter = ''): SongSummary[] {
    const f = filter.trim()
    // Title matches first: starts-with before contains.
    return this.db
      .prepare(
        `SELECT id, title, author FROM songs
         WHERE title LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 0 ELSE 1 END, title COLLATE NOCASE
         LIMIT 200`
      )
      .all(`%${escapeLike(f)}%`, `${escapeLike(f)}%`) as unknown as SongSummary[]
  }

  getSong(id: string): Song | null {
    const row = this.db.prepare('SELECT id, title, author, ccli_number, updated_at FROM songs WHERE id = ?').get(id) as
      | { id: string; title: string; author: string; ccli_number: string; updated_at: number }
      | undefined
    if (!row) return null
    const sections = this.db.prepare('SELECT label, text FROM song_sections WHERE song_id = ? ORDER BY ord').all(id) as unknown as Song['sections']
    const arr = this.db.prepare("SELECT sequence FROM song_arrangements WHERE song_id = ? AND name = 'Default'").get(id) as
      | { sequence: string }
      | undefined
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      ccli: row.ccli_number,
      sections,
      arrangement: arr?.sequence ? arr.sequence.split(',') : [],
      updatedAt: row.updated_at
    }
  }

  saveSong(input: SongInput): Song {
    const id = input.id && this.getSong(input.id) ? input.id : randomUUID()
    const now = this.clock()
    this.db.exec('BEGIN')
    try {
      this.db
        .prepare(
          `INSERT INTO songs (id, title, author, ccli_number, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title = excluded.title, author = excluded.author,
             ccli_number = excluded.ccli_number, updated_at = excluded.updated_at`
        )
        .run(id, input.title.trim(), input.author.trim(), input.ccli.trim(), now)
      this.db.prepare('DELETE FROM song_sections WHERE song_id = ?').run(id)
      const ins = this.db.prepare('INSERT INTO song_sections (song_id, ord, label, text) VALUES (?, ?, ?, ?)')
      input.sections.forEach((s, i) => ins.run(id, i, s.label, s.text))
      this.db
        .prepare(`INSERT INTO song_arrangements (song_id, name, sequence) VALUES (?, 'Default', ?)
                  ON CONFLICT(song_id, name) DO UPDATE SET sequence = excluded.sequence`)
        .run(id, input.arrangement.join(','))
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    return this.getSong(id)!
  }

  deleteSong(id: string): void {
    this.db.prepare('DELETE FROM songs WHERE id = ?').run(id)
  }

  // ---- backgrounds ----

  listBackgrounds(): LibraryBackground[] {
    const rows = this.db.prepare('SELECT id, kind, name, file, colour FROM backgrounds ORDER BY created_at').all() as unknown as {
      id: string
      kind: string
      name: string
      file: string | null
      colour: string | null
    }[]
    return rows.map((r) => ({ id: r.id, name: r.name, background: toBackground(r), builtIn: false }))
  }

  getBackground(id: string): LibraryBackground | null {
    return this.listBackgrounds().find((b) => b.id === id) ?? null
  }

  addBackground(name: string, background: Background): LibraryBackground {
    const id = randomUUID()
    this.db
      .prepare('INSERT INTO backgrounds (id, kind, name, file, colour, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, background.kind, name, background.kind === 'colour' ? null : background.file, background.kind === 'colour' ? background.colour : null, this.clock())
    return { id, name, background, builtIn: false }
  }

  deleteBackground(id: string): void {
    this.db.prepare('DELETE FROM backgrounds WHERE id = ?').run(id)
  }

  // ---- themes ----

  /** Saved themes; rows whose data no longer validates are skipped. */
  listThemes(): SavedTheme[] {
    const rows = this.db.prepare('SELECT id, name, data FROM themes ORDER BY name COLLATE NOCASE').all() as unknown as {
      id: string
      name: string
      data: string
    }[]
    return rows.flatMap((r) => {
      try {
        const parsed: unknown = JSON.parse(r.data)
        return isPartialTheme(parsed) ? [{ id: r.id, name: r.name, theme: { ...DEFAULT_THEME, ...parsed }, builtIn: false }] : []
      } catch {
        return []
      }
    })
  }

  /** Saving with an existing name replaces that theme. */
  saveTheme(name: string, theme: Theme): SavedTheme {
    const existing = this.db.prepare('SELECT id FROM themes WHERE name = ? COLLATE NOCASE').get(name) as { id: string } | undefined
    const id = existing?.id ?? randomUUID()
    this.db
      .prepare(
        `INSERT INTO themes (id, name, data, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data`
      )
      .run(id, name, JSON.stringify(theme), this.clock())
    return { id, name, theme, builtIn: false }
  }

  deleteTheme(id: string): void {
    this.db.prepare('DELETE FROM themes WHERE id = ?').run(id)
  }

  close(): void {
    this.db.close()
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

// All installed translations: public-domain files bundled in resources/bibles,
// plus licensed copies the church imports into its own data folder. Imported
// files never leave this machine and are never bundled with the app.

import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { TranslationInfo, TranslationSettings } from '../../shared/types'
import { BibleDb } from './bibleDb'
import { buildFromCsvFile, versesFromSqlite, writeBible, type BookResolver } from './importBible'

interface Entry {
  db: BibleDb
  bundled: boolean
  file: string
}

export const isTranslationCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z0-9]{2,10}$/.test(v)

export class BibleLibrary {
  private entries = new Map<string, Entry>()

  constructor(
    private bundledDir: string,
    private importDir: string,
    private resolveBook: BookResolver
  ) {
    this.scan(bundledDir, true)
    this.scan(importDir, false)
    if (this.entries.size === 0) throw new Error(`No Bible translations found in ${bundledDir}`)
  }

  private scan(dir: string, bundled: boolean): void {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.sqlite'))) this.open(join(dir, name), bundled)
  }

  private open(file: string, bundled: boolean): void {
    try {
      const db = new BibleDb(file)
      // A bundled translation always wins over an import with the same code.
      if (this.entries.has(db.info.code)) return db.close()
      this.entries.set(db.info.code, { db, bundled, file })
    } catch (err) {
      console.error(`[bible] skipping unreadable translation ${file}:`, err)
    }
  }

  list(): Omit<TranslationInfo, 'enabled'>[] {
    return [...this.entries.values()]
      .map((e) => ({ code: e.db.info.code, name: e.db.info.name, licence: e.db.info.licence, bundled: e.bundled }))
      .sort((a, b) => Number(b.bundled) - Number(a.bundled) || a.name.localeCompare(b.name))
  }

  get(code: string): BibleDb | undefined {
    return this.entries.get(code)?.db
  }

  /** Keeps saved settings consistent with what is installed: main is always enabled and installed. */
  normalise(saved: Partial<TranslationSettings> | null): TranslationSettings {
    const installed = this.list().map((t) => t.code)
    const enabled = (saved?.enabled ?? installed).filter((c) => installed.includes(c))
    let main = saved?.main && installed.includes(saved.main) ? saved.main : installed.includes('KJV') ? 'KJV' : installed[0]
    if (!enabled.includes(main)) enabled.unshift(main)
    return { main, enabled: installed.filter((c) => enabled.includes(c)) }
  }

  /** Imports a licensed translation from CSV (Book,Chapter,Verse,Text) or a SanctuaryCast SQLite file. */
  importFile(source: string, code: string, name: string): number {
    if (this.entries.get(code)?.bundled) throw new Error(`${code} is already installed with the app`)
    const ext = extname(source).toLowerCase()
    const meta = { code, name, language: 'en', licence: 'licensed' as const, source: 'Imported by the church' }
    const out = join(this.importDir, `${code.toLowerCase()}.sqlite`)
    mkdirSync(this.importDir, { recursive: true })
    // Close an older import of the same code so its file can be replaced.
    this.entries.get(code)?.db.close()
    this.entries.delete(code)
    let count: number
    if (ext === '.csv') count = buildFromCsvFile(source, out, meta, this.resolveBook)
    else if (ext === '.sqlite' || ext === '.db') count = writeBible(out, meta, versesFromSqlite(source))
    else throw new Error('Choose a .csv or .sqlite file')
    this.open(out, false)
    return count
  }

  remove(code: string): void {
    const e = this.entries.get(code)
    if (!e) return
    if (e.bundled) throw new Error(`${code} comes with the app and can't be removed`)
    e.db.close()
    this.entries.delete(code)
    rmSync(e.file, { force: true })
  }

  close(): void {
    for (const e of this.entries.values()) e.db.close()
    this.entries.clear()
  }
}

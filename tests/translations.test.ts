import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BibleLibrary, isTranslationCode } from '../src/main/bible/bibleLibrary'
import { parseCsv, versesFromCsv } from '../src/main/bible/importBible'
import { BOOKS } from '../src/parser/books'
import { bookIdFromName, parseReference } from '../src/parser/reference'

const RES = join(__dirname, '..', 'resources', 'bibles')
let dir: string
let bundled: string
let imports: string
let lib: BibleLibrary

/** A small licensed-style CSV: a few verses in every book, so it validates as a Bible. */
function sampleCsv(names: (b: (typeof BOOKS)[number]) => string = (b) => b.name, header = true): string {
  const rows = header ? ['Book,Chapter,Verse,Text'] : []
  for (const b of BOOKS) for (let v = 1; v <= 2; v++) rows.push(`${names(b)},1,${v},"Sample ${b.name} 1:${v}, with a comma"`)
  return rows.join('\r\n')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sc-bibles-'))
  bundled = join(dir, 'bundled')
  imports = join(dir, 'imports')
  mkdirSync(bundled)
  for (const f of ['kjv.sqlite', 'asv.sqlite']) copyFileSync(join(RES, f), join(bundled, f))
  lib = new BibleLibrary(bundled, imports, bookIdFromName)
})
afterEach(() => {
  lib.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('bundled translations', () => {
  it('ships only public-domain KJV and ASV', () => {
    expect(readdirSync(RES).sort()).toEqual(['asv.sqlite', 'kjv.sqlite'])
    expect(lib.list()).toEqual([
      { code: 'ASV', name: 'American Standard Version (1901)', licence: 'public-domain', bundled: true },
      { code: 'KJV', name: 'King James Version (1769)', licence: 'public-domain', bundled: true }
    ])
  })

  it('the same reference gives each translation its own text', () => {
    const ref = parseReference('John 3:16')!
    expect(lib.get('KJV')!.passage(ref)[0].text).toMatch(/believeth in him should not perish, but have everlasting life/)
    expect(lib.get('ASV')!.passage(ref)[0].text).toMatch(/believeth on him should not perish, but have eternal life/)
  })

  it('ASV has every book and chapter', () => {
    for (const b of BOOKS) expect(lib.get('ASV')!.lastVerse(b.id, b.chapters), b.name).toBeGreaterThan(0)
  })

  it('ASV "Selah" markers lose their bracket', () => {
    expect(lib.get('ASV')!.passage(parseReference('Psalm 3:2')!)[0].text).toMatch(/God\. Selah$/)
  })
})

describe('settings', () => {
  it('defaults to KJV main with everything enabled', () => {
    expect(lib.normalise(null)).toEqual({ main: 'KJV', enabled: ['ASV', 'KJV'] })
  })

  it('keeps main enabled and drops translations that are not installed', () => {
    expect(lib.normalise({ main: 'ASV', enabled: ['KJV', 'NIV'] })).toEqual({ main: 'ASV', enabled: ['ASV', 'KJV'] })
    expect(lib.normalise({ main: 'NIV', enabled: [] })).toEqual({ main: 'KJV', enabled: ['KJV'] })
  })

  it('validates translation codes', () => {
    for (const c of ['KJV', 'NIV', 'NKJV', 'YOR1900']) expect(isTranslationCode(c)).toBe(true)
    for (const c of ['k', 'kjv', '../x', 'TOOLONGCODE1', 'NI V']) expect(isTranslationCode(c)).toBe(false)
  })
})

describe('licensed imports', () => {
  it('imports a CSV into the church folder, never into the bundled folder', () => {
    const csv = join(dir, 'licensed.csv')
    writeFileSync(csv, sampleCsv())
    expect(lib.importFile(csv, 'NIV', 'New International Version')).toBe(132)
    expect(lib.list().find((t) => t.code === 'NIV')).toEqual({ code: 'NIV', name: 'New International Version', licence: 'licensed', bundled: false })
    expect(existsSync(join(imports, 'niv.sqlite'))).toBe(true)
    expect(readdirSync(bundled).sort()).toEqual(['asv.sqlite', 'kjv.sqlite'])
    expect(lib.get('NIV')!.passage(parseReference('Jude 2')!)[0].text).toBe('Sample Jude 1:2, with a comma')
  })

  it('reads book names like "I Samuel" and "Revelation of John", and files without a header', () => {
    const csv = join(dir, 'x.csv')
    const old = (b: (typeof BOOKS)[number]) => b.name.replace(/^1 /, 'I ').replace(/^2 /, 'II ').replace(/^3 /, 'III ').replace('Revelation', 'Revelation of John')
    writeFileSync(csv, sampleCsv(old, false))
    lib.importFile(csv, 'TPT', 'The Passion Translation')
    expect(lib.get('TPT')!.passage(parseReference('2 Samuel 1:1')!)[0].text).toBe('Sample 2 Samuel 1:1, with a comma')
    expect(lib.get('TPT')!.passage(parseReference('Revelation 1:2')!)[0].text).toBe('Sample Revelation 1:2, with a comma')
  })

  it('survives a restart and can be replaced or removed', () => {
    const csv = join(dir, 'a.csv')
    writeFileSync(csv, sampleCsv())
    lib.importFile(csv, 'NLT', 'New Living Translation')
    lib.close()
    lib = new BibleLibrary(bundled, imports, bookIdFromName)
    expect(lib.get('NLT')).toBeDefined()
    lib.importFile(csv, 'NLT', 'New Living Translation (2015)')
    expect(lib.list().filter((t) => t.code === 'NLT').map((t) => t.name)).toEqual(['New Living Translation (2015)'])
    lib.remove('NLT')
    expect(lib.get('NLT')).toBeUndefined()
    expect(existsSync(join(imports, 'nlt.sqlite'))).toBe(false)
  })

  it('refuses to overwrite or remove a bundled translation', () => {
    const csv = join(dir, 'a.csv')
    writeFileSync(csv, sampleCsv())
    expect(() => lib.importFile(csv, 'KJV', 'Fake KJV')).toThrow(/already installed/)
    expect(() => lib.remove('KJV')).toThrow(/comes with the app/)
  })

  it('rejects files that are not Bibles', () => {
    const bad = join(dir, 'bad.csv')
    writeFileSync(bad, 'name,email\nPat,pat@example.com')
    expect(() => lib.importFile(bad, 'AMP', 'Amplified')).toThrow(/not "Book,Chapter,Verse,Text"/)
    writeFileSync(bad, 'Book,Chapter,Verse,Text\nHezekiah,1,1,x\nJohn,1,1,y')
    expect(() => lib.importFile(bad, 'AMP', 'Amplified')).toThrow(/Unrecognised book names: Hezekiah/)
    writeFileSync(bad, 'Book,Chapter,Verse,Text\nJohn,1,1,only one verse')
    expect(() => lib.importFile(bad, 'AMP', 'Amplified')).toThrow(/usable verses/)
    const txt = join(dir, 'bible.txt')
    writeFileSync(txt, 'x')
    expect(() => lib.importFile(txt, 'AMP', 'Amplified')).toThrow(/\.csv or \.sqlite/)
    expect(lib.get('AMP')).toBeUndefined()
  })
})

describe('CSV parsing', () => {
  it('handles quotes, escaped quotes and commas', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['d', 'e', 'f']
    ])
  })

  it('falls back to file order when names are unknown but there are 66 books', () => {
    const rows = BOOKS.map((b, i) => [`Book${i}`, '1', '1', 'x'])
    expect(versesFromCsv(rows, () => null).map((v) => v.book)).toEqual(BOOKS.map((b) => b.id))
  })
})

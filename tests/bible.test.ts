import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BibleDb } from '../src/main/bible/bibleDb'
import { passageToItem, slideCharBudget, splitVerses, type Verse } from '../src/main/bible/passage'
import { DEFAULT_THEME } from '../src/main/engine/presentationEngine'
import { BOOKS } from '../src/parser/books'
import { parseReference } from '../src/parser/reference'

const db = new BibleDb(join(__dirname, '..', 'resources', 'bibles', 'kjv.sqlite'))
afterAll(() => db.close())

const passage = (q: string) => db.passage(parseReference(q)!)

describe('bundled KJV', () => {
  it('is public-domain KJV', () => {
    expect(db.info).toMatchObject({ code: 'KJV', licence: 'public-domain' })
  })

  it('has every chapter the parser knows about, and no more', () => {
    for (const b of BOOKS) {
      expect(db.lastVerse(b.id, b.chapters), `${b.name} ${b.chapters}`).toBeGreaterThan(0)
      expect(db.lastVerse(b.id, b.chapters + 1)).toBe(0)
    }
  })

  it('looks up a single verse', () => {
    const [v] = passage('John 5:10')
    expect(v).toMatchObject({ book: 43, chapter: 5, verse: 10 })
    expect(v.text).toMatch(/^The Jews therefore said unto him that was cured, It is the sabbath day/)
    expect(passage('John 3:16')[0].text).toMatch(/^For God so loved the world/)
  })

  it('looks up ranges, whole chapters and cross-chapter passages', () => {
    expect(passage('1cor13:4-7').map((v) => v.verse)).toEqual([4, 5, 6, 7])
    expect(passage('Psalm 23')).toHaveLength(6)
    const cross = passage('John 3:35-4:2')
    expect(cross.map((v) => `${v.chapter}:${v.verse}`)).toEqual(['3:35', '3:36', '4:1', '4:2'])
  })

  it('clamps a range past the end of the chapter and returns nothing for a missing verse', () => {
    expect(passage('Psalm 23:5-10').map((v) => v.verse)).toEqual([5, 6])
    expect(passage('John 3:99')).toEqual([])
  })

  it('strips the source italics brackets', () => {
    expect(passage('1 John 2:23')[0].text).not.toMatch(/[[\]]/)
  })

  it('finds verses by keyword, every word required', () => {
    const hits = db.search('charity suffereth long')
    expect(hits[0]).toMatchObject({ book: 46, chapter: 13, verse: 4 })
    expect(db.search('shepherd want').some((v) => v.book === 19 && v.chapter === 23 && v.verse === 1)).toBe(true)
  })

  it('treats search operators as plain words', () => {
    expect(() => db.search('love OR "NEAR( * ^')).not.toThrow()
    expect(db.search('')).toEqual([])
    expect(db.search('!!!')).toEqual([])
  })
})

describe('splitting passages', () => {
  const v = (verse: number, len: number): Verse => ({ book: 1, chapter: 1, verse, text: 'x'.repeat(len) })

  it('budget shrinks as font size grows', () => {
    expect(slideCharBudget({ fontSize: 96, margin: 96 })).toBeLessThan(slideCharBudget({ fontSize: 60, margin: 96 }))
    expect(slideCharBudget({ fontSize: 72, margin: 96 })).toBeGreaterThan(200)
  })

  it('splits only at verse boundaries and keeps order', () => {
    const groups = splitVerses([v(1, 100), v(2, 100), v(3, 100), v(4, 100)], 220)
    expect(groups.map((g) => g.map((x) => x.verse))).toEqual([[1, 2], [3, 4]])
  })

  it('gives an over-long verse its own slide', () => {
    expect(splitVerses([v(1, 50), v(2, 900), v(3, 50)], 200).map((g) => g.map((x) => x.verse))).toEqual([[1], [2], [3]])
  })

  it('builds slides with per-slide labels and verse numbers', () => {
    const item = passageToItem(passage('1 Corinthians 13'), DEFAULT_THEME, 'KJV', 'x')!
    expect(item.title).toBe('1 Corinthians 13:1–13 (KJV)')
    expect(item.slides.length).toBeGreaterThan(2)
    expect(item.slides[0].label).toMatch(/^1 Corinthians 13:1(–\d+)? \(KJV\)$/)
    expect(item.slides[0].section).toMatch(/^13:1/)
    const allVerses = item.slides.flatMap((s) => [...s.text.matchAll(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g)]).length
    expect(allVerses).toBeGreaterThanOrEqual(12)
    for (const s of item.slides) expect(s.text.length).toBeLessThanOrEqual(slideCharBudget(DEFAULT_THEME) + 200)
  })

  it('single verse has no verse number', () => {
    const item = passageToItem(passage('John 3:16'), DEFAULT_THEME, 'KJV', 'y')!
    expect(item.slides).toHaveLength(1)
    expect(item.slides[0].text.startsWith('For God')).toBe(true)
    expect(item.slides[0].label).toBe('John 3:16 (KJV)')
  })

  it('returns null for no verses', () => {
    expect(passageToItem([], DEFAULT_THEME, 'KJV', 'z')).toBeNull()
  })
})

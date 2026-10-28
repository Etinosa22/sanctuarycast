import { describe, expect, it } from 'vitest'
import { BOOKS, findBook } from '../src/parser/books'
import { formatReference, parseReference } from '../src/parser/reference'

const p = (s: string) => parseReference(s)

describe('book table', () => {
  it('has 66 books and 1189 chapters', () => {
    expect(BOOKS).toHaveLength(66)
    expect(BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189)
  })

  it('has no alias pointing at two books', () => {
    const seen = new Map<string, string>()
    for (const b of BOOKS)
      for (const a of b.aliases) {
        expect(seen.get(a), `${a} used by ${seen.get(a)} and ${b.name}`).toBeUndefined()
        seen.set(a, b.name)
      }
  })

  it('every full name and alias finds its own book', () => {
    for (const b of BOOKS) {
      expect(findBook(b.name.toLowerCase().replace(/\s/g, ''))?.id).toBe(b.id)
      for (const a of b.aliases) expect(findBook(a)?.id, a).toBe(b.id)
    }
  })

  it('rejects ambiguous prefixes', () => {
    expect(findBook('ma')).toBeNull() // Malachi, Mark, Matthew
    expect(findBook('j')).toBeNull()
  })
})

describe('parseReference', () => {
  it.each([
    ['John 5:10', { book: 43, chapter: 5, verse: 10 }],
    ['john 3:16', { book: 43, chapter: 3, verse: 16 }],
    ['jn 3 16', { book: 43, chapter: 3, verse: 16 }],
    ['Jn3:16', { book: 43, chapter: 3, verse: 16 }],
    ['1cor13:4-7', { book: 46, chapter: 13, verse: 4, endVerse: 7 }],
    ['1 Cor 13:4 - 7', { book: 46, chapter: 13, verse: 4, endVerse: 7 }],
    ['1 Corinthians 13:4–7', { book: 46, chapter: 13, verse: 4, endVerse: 7 }],
    ['I Corinthians 13', { book: 46, chapter: 13 }],
    ['First Corinthians 13:4', { book: 46, chapter: 13, verse: 4 }],
    ['Psalm 23', { book: 19, chapter: 23 }],
    ['Psalms 23:1-6', { book: 19, chapter: 23, verse: 1, endVerse: 6 }],
    ['ps 119.105', { book: 19, chapter: 119, verse: 105 }],
    ['Song of Solomon 2:4', { book: 22, chapter: 2, verse: 4 }],
    ['song 2:4', { book: 22, chapter: 2, verse: 4 }],
    ['I John 1:9', { book: 62, chapter: 1, verse: 9 }],
    ['1jn 4:8', { book: 62, chapter: 4, verse: 8 }],
    ['3 John 2', { book: 64, chapter: 1, verse: 2 }],
    ['Jude 5', { book: 65, chapter: 1, verse: 5 }],
    ['Philemon 1:6', { book: 57, chapter: 1, verse: 6 }],
    ['Phil 4:13', { book: 50, chapter: 4, verse: 13 }],
    ['John 3:16-4:2', { book: 43, chapter: 3, verse: 16, endChapter: 4, endVerse: 2 }],
    ['Romans 8:28 to 30', { book: 45, chapter: 8, verse: 28, endVerse: 30 }],
    ['Gen 1:1', { book: 1, chapter: 1, verse: 1 }],
    ['rev 22:21', { book: 66, chapter: 22, verse: 21 }],
    ['  Isaiah   53 : 5  ', { book: 23, chapter: 53, verse: 5 }],
    ['matt 5:3-12', { book: 40, chapter: 5, verse: 3, endVerse: 12 }],
    ['Mk 16:15', { book: 41, chapter: 16, verse: 15 }]
  ])('%s', (input, expected) => {
    expect(p(input)).toEqual(expected)
  })

  it.each(['love is patient', 'John', '', '3:16', 'Hezekiah 3:1', 'John 22:1', 'Psalm 151', 'John 3:16-4', 'ma 3:1', 'John 0:1', 'John 4:2-3:16'])(
    'rejects %j',
    (input) => {
      expect(p(input)).toBeNull()
    }
  )
})

describe('formatReference', () => {
  it.each([
    [{ book: 43, chapter: 5, verse: 10 }, 'John 5:10'],
    [{ book: 19, chapter: 23 }, 'Psalm 23'],
    [{ book: 46, chapter: 13, verse: 4, endVerse: 7 }, '1 Corinthians 13:4–7'],
    [{ book: 43, chapter: 3, verse: 16, endChapter: 4, endVerse: 2 }, 'John 3:16–4:2'],
    [{ book: 43, chapter: 3, verse: 16, endChapter: 3, endVerse: 16 }, 'John 3:16']
  ])('%j -> %s', (ref, text) => {
    expect(formatReference(ref)).toBe(text)
  })
})

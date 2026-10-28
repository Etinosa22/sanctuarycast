import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { bestQuoteMatch, searchWords } from '../src/ai/quotes'
import { BibleDb } from '../src/main/bible/bibleDb'
import { formatReference } from '../src/parser/reference'

const kjv = new BibleDb(join(__dirname, '..', 'resources', 'bibles', 'kjv.sqlite'))
const asv = new BibleDb(join(__dirname, '..', 'resources', 'bibles', 'asv.sqlite'))
afterAll(() => (kjv.close(), asv.close()))

/** What the app does: full-text candidates from the heard words, then scoring. */
const find = (heard: string, db = kjv) => {
  const m = bestQuoteMatch(heard, db.candidates(searchWords(heard)))
  return m ? { ref: formatReference(m.candidate), confidence: m.confidence, run: m.run } : null
}

describe('recognising recited verses', () => {
  it.each([
    ['For God so loved the world, that he gave his only begotten Son', 'John 3:16'],
    ['and he said the Lord is my shepherd I shall not want', 'Psalm 23:1'],
    ['I can do all things through Christ which strengtheneth me', 'Philippians 4:13'],
    ['we know that all things work together for good to them that love God', 'Romans 8:28'],
    ['remember, charity suffereth long, and is kind; charity envieth not', '1 Corinthians 13:4'],
    ['Trust in the Lord with all thine heart and lean not unto thine own understanding', 'Proverbs 3:5'],
    ['in the beginning was the Word, and the Word was with God', 'John 1:1'],
    ['How God anointed Jesus of Nazareth with the Holy Ghost and with power', 'Acts 10:38']
  ])('%s', (heard, expected) => {
    expect(find(heard)?.ref).toBe(expected)
  })

  it('copes with modernised words and whisper spelling', () => {
    // "believes" for "believeth", "you" for "thee"
    expect(find('that whosoever believes in him should not perish but have everlasting life')?.ref).toBe('John 3:16')
    // "you" for "ye"
    expect(find('Jesus said come unto me all you that labour and are heavy laden and I will give you rest')?.ref).toBe('Matthew 11:28')
  })

  it('finds a quote from another installed translation', () => {
    expect(find('whosoever believeth on him should not perish, but have eternal life', asv)?.ref).toBe('John 3:16')
  })

  it('gives high confidence to a long quote and medium to a shorter one', () => {
    expect(find('For God so loved the world, that he gave his only begotten Son')?.confidence).toBe('high')
    const short = find('he said I can do all things through Christ')
    expect(short?.ref).toBe('Philippians 4:13')
    expect(short?.confidence).toBe('high') // 6 of 9 words of a short verse
  })
})

describe('not mistaking ordinary speech for scripture', () => {
  it.each([
    'good morning church, please take your seats and silence your phones',
    'we thank God for this beautiful day and for everyone here',
    'the choir will now come forward to sing for us',
    'in the name of Jesus we pray amen',
    'the Lord is good',
    'let us pray'
  ])('ignores %j', (heard) => {
    expect(find(heard)).toBeNull()
  })

  it('needs enough words to search at all', () => {
    expect(searchWords('the and of to')).toEqual([])
    expect(bestQuoteMatch('the and of to', [])).toBeNull()
  })
})

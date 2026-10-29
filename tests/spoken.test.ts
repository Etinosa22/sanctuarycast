import { describe, expect, it } from 'vitest'
import { formatReference } from '../src/parser/reference'
import { detectReferences } from '../src/parser/spoken'

const refs = (text: string, ctx: Parameters<typeof detectReferences>[1] = null) =>
  detectReferences(text, ctx).detections.map((d) => formatReference(d.ref))

describe('what whisper writes', () => {
  it.each([
    ['Church, turn with me to the Book of John, chapter 3, verse 16.', 'John 3:16'],
    ['Open your Bibles to Philippians 4-13.', 'Philippians 4:13'],
    ['Later we will read Romans 8, 28.', 'Romans 8:28'],
    ['and 1 Corinthians 13 verses 4 to 7.', '1 Corinthians 13:4–7'],
    ['John 3:16-18 tells us', 'John 3:16–18'],
    ['Psalm 23', 'Psalm 23'],
    ['Psalms 119:105', 'Psalm 119:105'],
    ['in Revelation 22 verse 21', 'Revelation 22:21'],
    ['the book of Jude, verse 24', 'Jude 1:24']
  ])('%s', (text, expected) => {
    expect(refs(text)).toEqual([expected])
  })

  it('finds several references in one stretch of speech', () => {
    expect(refs('Church, turn with me to the Book of John, chapter 3, verse 16. And then go down to verse 18. Later we will read Romans 8, 28, and 1 Corinthians 13 verses 4 to 7.')).toEqual([
      'John 3:16',
      'John 3:18',
      'Romans 8:28',
      '1 Corinthians 13:4–7'
    ])
  })
})

describe('how whisper actually wrote references in the speech tests', () => {
  it.each([
    ['Lamentations 3.22 says his mercies are new.', 'Lamentations 3:22'],
    ['First Peter 5.7 tells us to cast our cares.', '1 Peter 5:7'],
    ['Go with me to Zephaniah 3.17', 'Zephaniah 3:17'],
    ['Hebrew 11 verse 1 defines faith', 'Hebrews 11:1'],
    ['Go with me to Zeppaniah 3.17', 'Zephaniah 3:17'],
    ['Go with me to Zeffaniah 3.17.', 'Zephaniah 3:17'],
    ['Blamentations 322 says his mercies are new.', 'Lamentations 3:22'],
    ['Lamentation 3 22', 'Lamentations 3:22'],
    ['Philippian 4 verse 13', 'Philippians 4:13'],
    ['Let us read 2nd Cesalonians 3 verse 3', '2 Thessalonians 3:3'],
    ['first Corintians 13 4', '1 Corinthians 13:4']
  ])('%s', (text, expected) => {
    expect(refs(text)).toEqual([expected])
  })

  it('a guessed spelling is never high confidence (so never Auto Live)', () => {
    expect(detectReferences('Zeppaniah 3.17').detections[0].confidence).toBe('medium')
    expect(detectReferences('Zephaniah 3.17').detections[0].confidence).toBe('high')
  })

  it.each(['I was generous 3 times', 'the general 2 said', 'romance 4 ever', 'we sang 3.5 songs', 'Hebrews was 3 hours long'])(
    'near-miss spelling ignores %j',
    (text) => {
      expect(refs(text)).toEqual([])
    }
  )
})

describe('chapter and verse run together by whisper', () => {
  it.each([
    ['we will read Romans 828, and', 'Romans 8:28'],
    ['John 316', 'John 3:16'],
    ['Romans 1213', 'Romans 12:13'],
    ['Psalm 23', 'Psalm 23'],
    ['Psalm 119', 'Psalm 119']
  ])('%s', (text, expected) => {
    expect(refs(text)).toEqual([expected])
  })

  it('does not split numbers that cannot be chapter and verse', () => {
    expect(refs('John 2201')).toEqual([])
  })
})

describe('spoken number words', () => {
  it.each([
    ['John three sixteen', 'John 3:16'],
    ['first Corinthians thirteen four', '1 Corinthians 13:4'],
    ['First Corinthians chapter thirteen verses four through seven', '1 Corinthians 13:4–7'],
    ['psalm one hundred and nineteen verse one hundred and five', 'Psalm 119:105'],
    ['psalm a hundred and three', 'Psalm 103'],
    ['Romans chapter eight verse twenty eight', 'Romans 8:28'],
    ['Romans eight twenty-eight', 'Romans 8:28'],
    ['second Timothy three sixteen', '2 Timothy 3:16'],
    ['third John verse two', '3 John 1:2'],
    ['Isaiah fifty three five', 'Isaiah 53:5'],
    ['Genesis chapter one', 'Genesis 1']
  ])('%s', (text, expected) => {
    expect(refs(text)).toEqual([expected])
  })
})

describe('current chapter context', () => {
  it('"verse eight" continues the chapter just mentioned', () => {
    expect(refs('Romans chapter eight. Look at verse one. Now verse eight.')).toEqual(['Romans 8', 'Romans 8:1', 'Romans 8:8'])
  })

  it('uses context passed in from what is on Live', () => {
    const r = detectReferences('go down to verse twelve', { book: 43, chapter: 3 })
    expect(r.detections.map((d) => [formatReference(d.ref), d.source])).toEqual([['John 3:12', 'context']])
  })

  it('"chapter five verse three" keeps the book', () => {
    expect(refs('chapter five verse three', { book: 45, chapter: 1 })).toEqual(['Romans 5:3'])
  })

  it('verse ranges in context', () => {
    expect(refs('read verses four to seven', { book: 46, chapter: 13 })).toEqual(['1 Corinthians 13:4–7'])
  })

  it('returns the updated context for the next chunk', () => {
    const first = detectReferences('Turn to Ephesians chapter two')
    expect(first.context).toEqual({ book: 49, chapter: 2 })
    expect(refs('verse eight says', first.context)).toEqual(['Ephesians 2:8'])
  })

  it('does not apply context when a chapter was said but its book was cut off', () => {
    expect(refs('13 verses 4 to 7.', { book: 45, chapter: 8 })).toEqual([])
  })

  it('a lone "verse" with no context is ignored', () => {
    expect(refs('the next verse 3 is lovely')).toEqual([])
  })
})

describe('avoiding false alarms', () => {
  it.each([
    'I want to mark 10 people present',
    'he had a job 2 years ago',
    'these numbers 4 and 5',
    'it is 5 oclock',
    'the acts 2 people did',
    'I John went home',
    'we sang three songs and prayed for twenty minutes',
    'John was there with 3 friends.',
    'Hezekiah 3:5'
  ])('ignores %j', (text) => {
    expect(refs(text)).toEqual([])
  })

  it('accepts everyday-word books when chapter or verse is said', () => {
    expect(refs('Mark chapter 10 verse 45')).toEqual(['Mark 10:45'])
    expect(refs('Acts 2:38')).toEqual(['Acts 2:38'])
    expect(refs('Job 19 verse 25')).toEqual(['Job 19:25'])
  })

  it('rejects chapters a book does not have', () => {
    expect(refs('John 25:1')).toEqual([])
    expect(refs('Jude chapter 2')).toEqual([])
  })

  it('reports confidence and what was heard', () => {
    const [d] = detectReferences('the Book of John, chapter 3, verse 16.').detections
    expect(d.confidence).toBe('high')
    expect(d.heard).toMatch(/john, chapter 3, verse 16/)
    expect(detectReferences('Psalm 23').detections[0].confidence).toBe('medium')
  })
})

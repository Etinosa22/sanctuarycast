// The 66 books of the Protestant canon in order, with KJV chapter counts and
// common abbreviations. Book numbers (1–66) are the ids used everywhere else.

export interface BookInfo {
  /** 1 = Genesis … 66 = Revelation */
  id: number
  name: string
  /** Singular form used in references, e.g. "Psalm 23". */
  refName: string
  chapters: number
  aliases: string[]
}

type Row = [name: string, chapters: number, aliases: string[], refName?: string]

const ROWS: Row[] = [
  ['Genesis', 50, ['gen', 'ge', 'gn']],
  ['Exodus', 40, ['exod', 'exo', 'ex']],
  ['Leviticus', 27, ['lev', 'le', 'lv']],
  ['Numbers', 36, ['num', 'nu', 'nm', 'nb']],
  ['Deuteronomy', 34, ['deut', 'deu', 'dt']],
  ['Joshua', 24, ['josh', 'jos', 'jsh']],
  ['Judges', 21, ['judg', 'jdg', 'jg', 'jdgs']],
  ['Ruth', 4, ['rut', 'rth', 'ru']],
  ['1 Samuel', 31, ['1sam', '1sa', '1sm', '1s']],
  ['2 Samuel', 24, ['2sam', '2sa', '2sm', '2s']],
  ['1 Kings', 22, ['1kgs', '1ki', '1kin', '1k']],
  ['2 Kings', 25, ['2kgs', '2ki', '2kin', '2k']],
  ['1 Chronicles', 29, ['1chr', '1ch', '1chron']],
  ['2 Chronicles', 36, ['2chr', '2ch', '2chron']],
  ['Ezra', 10, ['ezr', 'ez']],
  ['Nehemiah', 13, ['neh', 'ne']],
  ['Esther', 10, ['esth', 'est', 'es']],
  ['Job', 42, ['jb']],
  ['Psalms', 150, ['psalm', 'ps', 'psa', 'pss', 'psm', 'pslm'], 'Psalm'],
  ['Proverbs', 31, ['prov', 'pro', 'prv', 'pr']],
  ['Ecclesiastes', 12, ['eccl', 'ecc', 'ec', 'qoh']],
  ['Song of Solomon', 8, ['song', 'sos', 'so', 'songofsongs', 'canticles', 'sng']],
  ['Isaiah', 66, ['isa', 'is']],
  ['Jeremiah', 52, ['jer', 'je', 'jr']],
  ['Lamentations', 5, ['lam', 'la']],
  ['Ezekiel', 48, ['ezek', 'eze', 'ezk']],
  ['Daniel', 12, ['dan', 'da', 'dn']],
  ['Hosea', 14, ['hos', 'ho']],
  ['Joel', 3, ['joe', 'jl']],
  ['Amos', 9, ['amo', 'am']],
  ['Obadiah', 1, ['obad', 'oba', 'ob']],
  ['Jonah', 4, ['jon', 'jnh']],
  ['Micah', 7, ['mic', 'mc']],
  ['Nahum', 3, ['nah', 'na']],
  ['Habakkuk', 3, ['hab', 'hb']],
  ['Zephaniah', 3, ['zeph', 'zep', 'zp']],
  ['Haggai', 2, ['hag', 'hg']],
  ['Zechariah', 14, ['zech', 'zec', 'zc']],
  ['Malachi', 4, ['mal', 'ml']],
  ['Matthew', 28, ['matt', 'mat', 'mt']],
  ['Mark', 16, ['mrk', 'mar', 'mk', 'mr']],
  ['Luke', 24, ['luk', 'lk']],
  ['John', 21, ['jn', 'jhn', 'joh']],
  ['Acts', 28, ['act', 'ac']],
  ['Romans', 16, ['rom', 'ro', 'rm']],
  ['1 Corinthians', 16, ['1cor', '1co']],
  ['2 Corinthians', 13, ['2cor', '2co']],
  ['Galatians', 6, ['gal', 'ga']],
  ['Ephesians', 6, ['eph', 'ephes']],
  ['Philippians', 4, ['phil', 'php', 'pp']],
  ['Colossians', 4, ['col', 'co']],
  ['1 Thessalonians', 5, ['1thess', '1thes', '1th']],
  ['2 Thessalonians', 3, ['2thess', '2thes', '2th']],
  ['1 Timothy', 6, ['1tim', '1ti', '1tm']],
  ['2 Timothy', 4, ['2tim', '2ti', '2tm']],
  ['Titus', 3, ['tit', 'ti']],
  ['Philemon', 1, ['philem', 'phm', 'pm']],
  ['Hebrews', 13, ['heb']],
  ['James', 5, ['jas', 'jm']],
  ['1 Peter', 5, ['1pet', '1pe', '1pt', '1p']],
  ['2 Peter', 3, ['2pet', '2pe', '2pt', '2p']],
  ['1 John', 5, ['1jn', '1jhn', '1joh', '1jo', '1j']],
  ['2 John', 1, ['2jn', '2jhn', '2joh', '2jo', '2j']],
  ['3 John', 1, ['3jn', '3jhn', '3joh', '3jo', '3j']],
  ['Jude', 1, ['jud', 'jd']],
  ['Revelation', 22, ['rev', 're', 'rv', 'revelations', 'apocalypse', 'revelationofjohn']]
]

export const BOOKS: BookInfo[] = ROWS.map(([name, chapters, aliases, refName], i) => ({
  id: i + 1,
  name,
  refName: refName ?? name,
  chapters,
  aliases
}))

/** Lowercase, no spaces or dots: "1 Corinthians" -> "1corinthians". */
export const compact = (s: string) => s.toLowerCase().replace(/[\s.]+/g, '')

const exact = new Map<string, BookInfo>()
for (const b of BOOKS) {
  exact.set(compact(b.name), b)
  for (const a of b.aliases) exact.set(a, b)
}

/**
 * Finds a book from compacted text with a numeric prefix ("1cor", "john").
 * Exact names and aliases win; otherwise an unambiguous prefix of a full name.
 */
export function findBook(key: string): BookInfo | null {
  if (!key) return null
  const hit = exact.get(key)
  if (hit) return hit
  if (key.replace(/^\d/, '').length < 2) return null
  const matches = BOOKS.filter((b) => compact(b.name).startsWith(key))
  return matches.length === 1 ? matches[0] : null
}

export const bookById = (id: number): BookInfo | undefined => BOOKS[id - 1]

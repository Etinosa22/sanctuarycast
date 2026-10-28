// Builds resources/bibles/kjv.sqlite from the public-domain KJV CSV
// (scrollmapper/bible_databases, formats/csv/KJV.csv).
// Usage: node scripts/build-kjv.mjs <path-to-KJV.csv>

import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const csvPath = process.argv[2]
if (!csvPath) throw new Error('Usage: node scripts/build-kjv.mjs <KJV.csv>')
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'bibles', 'kjv.sqlite')

// Book names as they appear in the CSV, in canonical order (1 = Genesis).
const CSV_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', 'I Samuel', 'II Samuel',
  'I Kings', 'II Kings', 'I Chronicles', 'II Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark',
  'Luke', 'John', 'Acts', 'Romans', 'I Corinthians', 'II Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', 'I Thessalonians', 'II Thessalonians', 'I Timothy', 'II Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', 'I Peter', 'II Peter', 'I John', 'II John', 'III John', 'Jude', 'Revelation of John'
]
const bookId = new Map(CSV_BOOKS.map((n, i) => [n, i + 1]))

/** Minimal RFC 4180 parser: quoted fields with "" escapes. */
function* rows(text) {
  let i = 0
  while (i < text.length) {
    const row = []
    for (;;) {
      let field = ''
      if (text[i] === '"') {
        i++
        for (;;) {
          if (text[i] === '"' && text[i + 1] === '"') (field += '"'), (i += 2)
          else if (text[i] === '"') { i++; break }
          else field += text[i++]
        }
      } else {
        while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') field += text[i++]
      }
      row.push(field)
      if (text[i] === ',') { i++; continue }
      if (text[i] === '\r') i++
      if (text[i] === '\n') i++
      break
    }
    yield row
  }
}

const all = [...rows(readFileSync(csvPath, 'utf8'))]
const header = all.shift()
if (header.join(',') !== 'Book,Chapter,Verse,Text') throw new Error(`Unexpected header: ${header}`)

if (existsSync(out)) rmSync(out)
mkdirSync(dirname(out), { recursive: true })
const db = new DatabaseSync(out)
db.exec(`
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE verses (book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL,
                       PRIMARY KEY (book, chapter, verse));
  CREATE VIRTUAL TABLE verses_fts USING fts5(text, content='verses', content_rowid='rowid', tokenize='porter unicode61');
`)
const meta = db.prepare('INSERT INTO meta VALUES (?, ?)')
for (const [k, v] of Object.entries({
  code: 'KJV',
  name: 'King James Version (1769)',
  language: 'en',
  licence: 'public-domain',
  source: 'scrollmapper/bible_databases formats/csv/KJV.csv'
})) meta.run(k, v)

const insert = db.prepare('INSERT INTO verses (book, chapter, verse, text) VALUES (?, ?, ?, ?)')
let count = 0
db.exec('BEGIN')
for (const row of all) {
  if (row.length === 1 && row[0] === '') continue
  const [book, chapter, verse, text] = row
  const id = bookId.get(book)
  if (!id) throw new Error(`Unknown book "${book}"`)
  // The source marks a few translators' italics with [brackets]; project the words plain.
  insert.run(id, Number(chapter), Number(verse), text.replace(/[[\]]/g, '').trim())
  count++
}
db.exec('COMMIT')
db.exec("INSERT INTO verses_fts(verses_fts) VALUES ('rebuild')")
db.exec('VACUUM')
db.close()
console.log(`Wrote ${count} verses to ${out}`)

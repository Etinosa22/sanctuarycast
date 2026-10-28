// Builds a bundled public-domain translation into resources/bibles/<code>.sqlite.
// Usage (Node 22.6+):
//   node --experimental-strip-types scripts/build-bible.ts <file.csv> <CODE> "<Full name>" "<source>"
// Only public-domain texts go in resources/. Licensed translations are imported
// by the church inside the app and never bundled.

import { join } from 'node:path'
import { buildFromCsvFile } from '../src/main/bible/importBible.ts'

const [csv, code, name, source] = process.argv.slice(2)
if (!csv || !code || !name) {
  console.error('Usage: node --experimental-strip-types scripts/build-bible.ts <file.csv> <CODE> "<Full name>" "<source>"')
  process.exit(1)
}
const out = join(import.meta.dirname, '..', 'resources', 'bibles', `${code.toLowerCase()}.sqlite`)
const count = buildFromCsvFile(csv, out, { code: code.toUpperCase(), name, language: 'en', licence: 'public-domain', source: source ?? '' })
console.log(`Wrote ${count} verses to ${out}`)

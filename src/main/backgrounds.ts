// Imported background media: copied into the app's backgrounds folder under a
// random name, then served to windows as sc-media://bg/<file>.

import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { Background, LibraryBackground } from '../shared/types'
import type { Library } from './db/library'
import { isMediaFileName } from './engine/validate'

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
export const VIDEO_EXTENSIONS = ['mp4', 'webm']
/** Keeps memory and disk sane on the 8 GB target laptop. */
export const MAX_IMPORT_BYTES = 400 * 1024 * 1024

export const STARTER_BACKGROUNDS: LibraryBackground[] = [
  ['navy', 'Navy', '#0b1d3a'],
  ['wine', 'Wine', '#4a1022'],
  ['forest', 'Forest', '#123524'],
  ['charcoal', 'Charcoal', '#222222'],
  ['sky', 'Sky', 'linear-gradient(160deg, #1e3a8a, #0ea5e9)'],
  ['dusk', 'Dusk', 'linear-gradient(160deg, #3b0764, #be185d)'],
  ['black', 'Black', '#000000']
].map(([id, name, colour]) => ({ id: `builtin-${id}`, name, background: { kind: 'colour', colour }, builtIn: true }))

export type ImportResult = { ok: true; name: string; background: Background } | { ok: false; reason: string }

/** Copies one picked file into the backgrounds folder. */
export function importMediaFile(source: string, dir: string): ImportResult {
  const ext = extname(source).slice(1).toLowerCase()
  const kind = IMAGE_EXTENSIONS.includes(ext) ? 'image' : VIDEO_EXTENSIONS.includes(ext) ? 'video' : null
  if (!kind) return { ok: false, reason: `${basename(source)}: only JPG, PNG, WebP, MP4 and WebM are supported` }
  if (statSync(source).size > MAX_IMPORT_BYTES) return { ok: false, reason: `${basename(source)} is larger than 400 MB` }
  mkdirSync(dir, { recursive: true })
  const file = `${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`
  copyFileSync(source, join(dir, file))
  return { ok: true, name: basename(source, extname(source)), background: { kind, file } }
}

/** Throws if the file exists but can't be deleted (e.g. Windows has it open). */
export function removeMediaFile(dir: string, file: string): void {
  if (isMediaFileName(file)) rmSync(join(dir, file), { force: true })
}

/**
 * Safety net run at every start: any imported image or video in the folder
 * that has no library record is added back, so an upload can never silently
 * disappear. Returns how many were recovered.
 */
export function recoverOrphanMedia(library: Library, dir: string): number {
  if (!existsSync(dir)) return 0
  const known = new Set(library.listBackgrounds().flatMap((b) => (b.background.kind === 'colour' ? [] : [b.background.file])))
  const orphans = readdirSync(dir).filter((f) => isMediaFileName(f) && !known.has(f))
  // Oldest first so numbering follows the order they were added.
  orphans.sort((a, b) => statSync(join(dir, a)).mtimeMs - statSync(join(dir, b)).mtimeMs)
  orphans.forEach((file, i) => {
    const kind = VIDEO_EXTENSIONS.includes(extname(file).slice(1)) ? 'video' : 'image'
    library.addBackground(`Recovered ${kind} ${i + 1}`, { kind, file })
  })
  return orphans.length
}

/** Resolves a sc-media://bg/<file> request to a path, or null if it isn't one of ours. */
export function mediaPathFromUrl(url: string, dir: string): string | null {
  const u = new URL(url)
  if (u.host !== 'bg') return null
  const file = decodeURIComponent(u.pathname.replace(/^\//, ''))
  return isMediaFileName(file) ? join(dir, file) : null
}

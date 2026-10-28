import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importMediaFile, mediaPathFromUrl, removeMediaFile, STARTER_BACKGROUNDS } from '../src/main/backgrounds'
import { Library } from '../src/main/db/library'
import { DEFAULT_THEME } from '../src/main/engine/presentationEngine'
import { isBackground, isSafeColour, isSongInput, isTheme } from '../src/main/engine/validate'
import { STARTER_THEMES } from '../src/main/themes'
import { demoSongs } from '../src/main/service/demoService'
import type { SongInput } from '../src/shared/types'

let dir: string
let lib: Library

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sc-lib-'))
  lib = new Library(join(dir, 'library.sqlite'))
})
afterEach(() => {
  lib.close()
  rmSync(dir, { recursive: true, force: true })
})

const song = (title: string): SongInput => ({
  title,
  author: 'Anon',
  ccli: '',
  sections: [
    { label: 'V1', text: 'a' },
    { label: 'C', text: 'b' }
  ],
  arrangement: ['V1', 'C', 'C']
})

describe('songs', () => {
  it('saves and reloads a song with sections and arrangement', () => {
    const saved = lib.saveSong(song('Great Is Thy Faithfulness'))
    expect(lib.getSong(saved.id)).toEqual(saved)
    expect(saved.arrangement).toEqual(['V1', 'C', 'C'])
  })

  it('searches by the saved title, case-insensitive, starts-with first', () => {
    for (const t of ['Blessed Assurance', 'How Great Thou Art', 'Great Is Thy Faithfulness', 'Amazing Grace']) lib.saveSong(song(t))
    expect(lib.listSongs('great').map((s) => s.title)).toEqual(['Great Is Thy Faithfulness', 'How Great Thou Art'])
    expect(lib.listSongs('AMAZING').map((s) => s.title)).toEqual(['Amazing Grace'])
    expect(lib.listSongs('')).toHaveLength(4)
    expect(lib.listSongs('100%_')).toEqual([])
  })

  it('updates in place when saved with its id', () => {
    const s = lib.saveSong(song('Old title'))
    lib.saveSong({ ...song('New title'), id: s.id, sections: [{ label: 'V1', text: 'changed' }], arrangement: ['V1'] })
    expect(lib.listSongs('')).toHaveLength(1)
    expect(lib.getSong(s.id)).toMatchObject({ title: 'New title', sections: [{ label: 'V1', text: 'changed' }], arrangement: ['V1'] })
  })

  it('deletes a song and its sections', () => {
    const s = lib.saveSong(song('Gone'))
    lib.deleteSong(s.id)
    expect(lib.getSong(s.id)).toBeNull()
  })

  it('seeds the starter hymns only once', () => {
    lib.seedOnce('starter', () => demoSongs().forEach((s) => lib.saveSong(s)))
    lib.seedOnce('starter', () => demoSongs().forEach((s) => lib.saveSong(s)))
    expect(lib.listSongs('').map((s) => s.title)).toEqual(['Amazing Grace', 'Holy, Holy, Holy'])
  })

  it('survives reopening the file', () => {
    lib.saveSong(song('Persisted'))
    lib.close()
    lib = new Library(join(dir, 'library.sqlite'))
    expect(lib.listSongs('pers')).toHaveLength(1)
  })
})

describe('song validation', () => {
  it('requires a title, unique labels and an arrangement of known labels', () => {
    expect(isSongInput(song('ok'))).toBe(true)
    expect(isSongInput(song('   '))).toBe(false)
    expect(isSongInput({ ...song('x'), arrangement: ['V9'] })).toBe(false)
    expect(isSongInput({ ...song('x'), sections: [] })).toBe(false)
    expect(isSongInput({ ...song('x'), sections: [{ label: 'V1', text: 'a' }, { label: 'V1', text: 'b' }], arrangement: [] })).toBe(false)
    for (const s of demoSongs()) expect(isSongInput(s)).toBe(true)
  })
})

describe('backgrounds', () => {
  it('imports an image under a random name and records it', () => {
    const src = join(dir, 'Sunrise Photo.PNG')
    writeFileSync(src, 'fake png')
    const media = join(dir, 'backgrounds')
    const r = importMediaFile(src, media)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.name).toBe('Sunrise Photo')
    expect(r.background.kind).toBe('image')
    expect(isBackground(r.background)).toBe(true)
    expect(readdirSync(media)).toHaveLength(1)

    const entry = lib.addBackground(r.name, r.background)
    expect(lib.listBackgrounds()).toEqual([entry])
    if (r.background.kind !== 'colour') {
      removeMediaFile(media, r.background.file)
      expect(existsSync(join(media, r.background.file))).toBe(false)
    }
  })

  it('accepts videos and refuses other file types', () => {
    const mp4 = join(dir, 'loop.mp4')
    writeFileSync(mp4, 'x')
    expect(importMediaFile(mp4, join(dir, 'bg'))).toMatchObject({ ok: true, background: { kind: 'video' } })
    const exe = join(dir, 'virus.exe')
    writeFileSync(exe, 'x')
    expect(importMediaFile(exe, join(dir, 'bg')).ok).toBe(false)
  })

  it('stores custom colours', () => {
    lib.addBackground('#ff8800', { kind: 'colour', colour: '#ff8800' })
    expect(lib.listBackgrounds()[0].background).toEqual({ kind: 'colour', colour: '#ff8800' })
  })

  it('only serves our own media names from the media protocol', () => {
    const name = '0b8e9f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b.png'
    expect(mediaPathFromUrl(`sc-media://bg/${name}`, '/m')).toBe(join('/m', name))
    expect(mediaPathFromUrl('sc-media://bg/..%2F..%2Fsecret.txt', '/m')).toBeNull()
    expect(mediaPathFromUrl('sc-media://bg/C:%5CWindows%5Cwin.ini', '/m')).toBeNull()
    expect(mediaPathFromUrl(`sc-media://other/${name}`, '/m')).toBeNull()
  })

  it('colour validation blocks anything that could load a URL', () => {
    expect(isSafeColour('#0b1d3a')).toBe(true)
    expect(isSafeColour('linear-gradient(160deg, #1e3a8a, #0ea5e9)')).toBe(true)
    expect(isSafeColour('url(http://evil)')).toBe(false)
    expect(isSafeColour('red; background-image: x')).toBe(false)
    for (const b of STARTER_BACKGROUNDS) expect(isBackground(b.background)).toBe(true)
  })
})

describe('themes', () => {
  const theme = { ...DEFAULT_THEME, fontSize: 90, position: 'bottom' as const }

  it('saves, lists and deletes a theme', () => {
    const saved = lib.saveTheme('Easter', theme)
    expect(lib.listThemes()).toEqual([saved])
    lib.deleteTheme(saved.id)
    expect(lib.listThemes()).toEqual([])
  })

  it('saving the same name again replaces it, ignoring case', () => {
    lib.saveTheme('Youth', theme)
    lib.saveTheme('youth', { ...theme, fontSize: 60 })
    expect(lib.listThemes()).toHaveLength(1)
    expect(lib.listThemes()[0].theme.fontSize).toBe(60)
  })

  it('starter themes are complete, valid and uniquely named', () => {
    for (const t of STARTER_THEMES) expect(isTheme(t.theme), t.name).toBe(true)
    expect(new Set(STARTER_THEMES.map((t) => t.name.toLowerCase())).size).toBe(STARTER_THEMES.length)
  })

  it('theme validation rejects out-of-range or missing settings', () => {
    expect(isTheme(theme)).toBe(true)
    expect(isTheme({ ...theme, fontSize: 0 })).toBe(false)
    expect(isTheme({ ...theme, margin: 9999 })).toBe(false)
    const { colour: _c, ...partial } = theme
    expect(isTheme(partial)).toBe(false)
  })
})

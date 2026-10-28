// IPC for the Bible, song and background libraries. Console only, every input
// validated; nothing here can write to Live.

import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { formatReference, parseReference } from '../parser/reference'
import type { BibleSearchResult, LibraryBackground, PresentationState, TranslationSettings } from '../shared/types'
import { importMediaFile, IMAGE_EXTENSIONS, removeMediaFile, STARTER_BACKGROUNDS, VIDEO_EXTENSIONS } from './backgrounds'
import { BibleLibrary, isTranslationCode } from './bible/bibleLibrary'
import { passageToItem } from './bible/passage'
import { Library } from './db/library'
import { isSafeColour, isSongInput, isTheme } from './engine/validate'
import { STARTER_THEMES } from './themes'

const isStr = (v: unknown): v is string => typeof v === 'string'

interface Deps {
  bibles: BibleLibrary
  library: Library
  mediaDir: string
  engineState: () => PresentationState
  /** Window to parent the file picker to; null if the sender isn't the console. */
  consoleFor: (senderId: number) => BrowserWindow | null
}

export function registerLibraryIpc({ bibles, library, mediaDir, engineState, consoleFor }: Deps): void {
  const handle = <A extends unknown[], R>(channel: string, fn: (win: BrowserWindow, ...args: A) => R) =>
    ipcMain.handle(channel, (e, ...args) => {
      const win = consoleFor(e.sender.id)
      if (!win) throw new Error('Library is only available to the operator console')
      return fn(win, ...(args as A))
    })

  const settings = () => bibles.normalise(library.getSetting<TranslationSettings>('bible.translations'))
  const translationsView = () => {
    const s = settings()
    return { translations: bibles.list().map((t) => ({ ...t, enabled: s.enabled.includes(t.code) })), main: s.main }
  }

  handle('bible:search', (_w, query: unknown, translation: unknown): BibleSearchResult => {
    const q = isStr(query) ? query.slice(0, 200) : ''
    const code = isTranslationCode(translation) && bibles.get(translation) ? translation : settings().main
    const bible = bibles.get(code)!
    const ref = parseReference(q)
    if (ref) {
      const verses = bible.passage(ref)
      const id = `bible-${code}-${formatReference(ref).replace(/\W+/g, '-')}`
      return { passage: passageToItem(verses, engineState().theme, code, id), hits: [], translation: code }
    }
    const hits = q.trim().length >= 3 ? bible.search(q, 15) : []
    return {
      passage: null,
      hits: hits.map((v) => ({ ref: formatReference({ book: v.book, chapter: v.chapter, verse: v.verse }), text: v.text })),
      translation: code
    }
  })

  handle('bible:translations', () => translationsView())

  handle('bible:setTranslations', (_w, input: unknown) => {
    const v = input as Partial<TranslationSettings> | null
    if (!v || !isTranslationCode(v.main) || !Array.isArray(v.enabled) || !v.enabled.every(isTranslationCode)) {
      throw new Error('Invalid translation settings')
    }
    library.setSetting('bible.translations', bibles.normalise({ main: v.main, enabled: v.enabled }))
    return translationsView()
  })

  handle('bible:importTranslation', async (win, input: unknown) => {
    const v = (input ?? {}) as { code?: unknown; name?: unknown; licenceConfirmed?: unknown }
    const code = isStr(v.code) ? v.code.trim().toUpperCase() : ''
    const name = isStr(v.name) ? v.name.trim().slice(0, 100) : ''
    if (!isTranslationCode(code)) return { ok: false, message: 'Code must be 2–10 letters or digits, e.g. NIV' }
    if (!name) return { ok: false, message: 'Give the translation its full name' }
    // Copyrighted texts are only imported from a copy the church is licensed to project.
    if (v.licenceConfirmed !== true) return { ok: false, message: 'Confirm the church holds a licence to project this translation' }
    const picked = await dialog.showOpenDialog(win, {
      title: `Import ${code}`,
      properties: ['openFile'],
      filters: [{ name: 'Bible text (CSV: Book,Chapter,Verse,Text) or SanctuaryCast SQLite', extensions: ['csv', 'sqlite', 'db'] }]
    })
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, message: 'Import cancelled' }
    try {
      const count = bibles.importFile(picked.filePaths[0], code, name)
      const s = settings()
      library.setSetting('bible.translations', bibles.normalise({ ...s, enabled: [...s.enabled, code] }))
      return { ok: true, message: `Imported ${count.toLocaleString()} verses of ${code}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  handle('bible:removeTranslation', (_w, code: unknown) => {
    if (!isTranslationCode(code)) return
    bibles.remove(code)
    library.setSetting('bible.translations', settings())
  })

  handle('songs:list', (_w, filter: unknown) => library.listSongs(isStr(filter) ? filter.slice(0, 200) : ''))
  handle('songs:get', (_w, id: unknown) => (isStr(id) ? library.getSong(id) : null))
  handle('songs:save', (_w, song: unknown) => {
    if (!isSongInput(song)) throw new Error('Song is missing a title or has invalid sections')
    return library.saveSong(song)
  })
  handle('songs:remove', (_w, id: unknown) => {
    if (isStr(id)) library.deleteSong(id)
  })

  const allBackgrounds = (): LibraryBackground[] => [...STARTER_BACKGROUNDS, ...library.listBackgrounds()]
  handle('backgrounds:list', () => allBackgrounds())

  handle('backgrounds:importFiles', async (win) => {
    const picked = await dialog.showOpenDialog(win, {
      title: 'Add backgrounds',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images and videos', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] }]
    })
    if (picked.canceled) return []
    const added: LibraryBackground[] = []
    const problems: string[] = []
    for (const path of picked.filePaths) {
      const r = importMediaFile(path, mediaDir)
      if (r.ok) added.push(library.addBackground(r.name, r.background))
      else problems.push(r.reason)
    }
    if (problems.length) void dialog.showMessageBox(win, { type: 'warning', message: 'Some files were not added', detail: problems.join('\n') })
    return added
  })

  handle('backgrounds:addColour', (_w, colour: unknown) => {
    if (!isSafeColour(colour)) throw new Error('Not a colour')
    return library.addBackground(colour, { kind: 'colour', colour })
  })

  handle('themes:list', () => [...STARTER_THEMES, ...library.listThemes()])
  handle('themes:save', (_w, name: unknown, theme: unknown) => {
    const n = isStr(name) ? name.trim() : ''
    if (!n || n.length > 60) throw new Error('Give the theme a name (up to 60 characters)')
    if (STARTER_THEMES.some((t) => t.name.toLowerCase() === n.toLowerCase())) throw new Error(`"${n}" is a starter theme; pick another name`)
    if (!isTheme(theme)) throw new Error('Theme settings are out of range')
    return library.saveTheme(n, theme)
  })
  handle('themes:remove', (_w, id: unknown) => {
    if (isStr(id)) library.deleteTheme(id)
  })

  handle('backgrounds:remove', (_w, id: unknown) => {
    if (!isStr(id)) return { ok: false, reason: 'Unknown background' }
    const bg = library.getBackground(id)
    if (!bg) return { ok: false, reason: 'Starter backgrounds cannot be removed' }
    const s = engineState()
    const inUse = [s.live?.background, s.preview?.background, s.background].some((b) => JSON.stringify(b) === JSON.stringify(bg.background))
    if (inUse) return { ok: false, reason: 'This background is in Preview or Live. Switch to another one first.' }
    library.deleteBackground(id)
    if (bg.background.kind !== 'colour') removeMediaFile(mediaDir, bg.background.file)
    return { ok: true }
  })
}

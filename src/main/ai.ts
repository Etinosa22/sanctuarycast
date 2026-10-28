// IPC for scripture detection. Audio chunks from the console go to the whisper
// sidecar; transcripts go through the reference detector and, failing that, the
// recited-verse matcher; suggestions go back to the console. What happens next
// depends on the mode the operator chose (src/ai/auto.ts): a card only, the
// passage in Preview, or (only when sure, and only if turned on) Preview and Live.

import { ipcMain } from 'electron'
import { autoActions, isAiMode } from '../ai/auto'
import type { ReferenceDetector } from '../ai/detector'
import type { WhisperSidecar } from '../ai/whisperSidecar'
import { formatReference, parseReference, type ScriptureRef } from '../parser/reference'
import type { AiEvent, AiMode, AiSuggestion, EngineAction, PresentationState, ServiceItem } from '../shared/types'

/** Longest chunk accepted: 10 s of 16 kHz 16-bit mono. */
const MAX_CHUNK_BYTES = 16_000 * 2 * 10

export interface QuoteHit {
  ref: ScriptureRef
  confidence: 'high' | 'medium'
  heard: string
}

interface Deps {
  sidecar: WhisperSidecar
  detector: ReferenceDetector
  lookup: (ref: ScriptureRef) => ServiceItem | null
  /** Recognises a verse from recited words, or null. */
  quoteSearch: (text: string) => QuoteHit | null
  /** Label of the scripture slide on Live, e.g. "John 3:16 (KJV)", if any. */
  liveLabel: () => string | undefined
  engineState: () => PresentationState
  dispatch: (action: EngineAction) => void
  getMode: () => AiMode
  setMode: (mode: AiMode) => void
  isConsole: (senderId: number) => boolean
  emit: (e: AiEvent) => void
}

export function registerAiIpc(deps: Deps): void {
  const { sidecar, detector, lookup, quoteSearch, liveLabel, isConsole, emit } = deps
  let lastLive: string | undefined
  let lastAutoPreviewId: string | null = null

  /** "verse eight" should mean the chapter on Live when the operator changes it. */
  const followLive = () => {
    const label = liveLabel()
    if (!label || label === lastLive) return
    lastLive = label
    const ref = parseReference(label.replace(/\s*\([^)]*\)\s*$/, ''))
    if (ref) detector.setContext({ book: ref.book, chapter: ref.chapter })
  }

  const offer = (s: Omit<AiSuggestion, 'auto'>) => {
    const first = s.item.slides[0]
    let auto: AiSuggestion['auto']
    if (first) {
      const r = autoActions({ mode: deps.getMode(), confidence: s.confidence, source: s.source, state: deps.engineState(), lastAutoPreviewId }, first)
      r.actions.forEach(deps.dispatch)
      if (r.applied) {
        auto = r.applied
        lastAutoPreviewId = first.id
      }
    }
    emit({ type: 'suggestion', suggestion: { ...s, auto } })
  }

  const handleText = (text: string, origin: 'speech' | 'typed'): number => {
    followLive()
    let count = 0
    for (const d of detector.feed(text, { complete: origin === 'typed' })) {
      const item = lookup(d.ref)
      if (!item) continue // e.g. "John 3:99": no such verse
      count++
      offer({ key: d.key, item, confidence: d.confidence, source: d.source, heard: d.heard, at: d.at, origin, replaces: d.replaces })
    }
    if (count > 0) return count

    // No reference said: is the preacher reciting a verse?
    const q = quoteSearch(text)
    if (!q) return 0
    const key = formatReference(q.ref)
    if (!detector.claim(key)) return 0
    const item = lookup(q.ref)
    if (!item) return 0
    // So "verse 17" right after a recited John 3:16 means John 3:17.
    detector.setContext({ book: q.ref.book, chapter: q.ref.chapter })
    offer({ key, item, confidence: q.confidence, source: 'quote', heard: q.heard, at: Date.now(), origin })
    return 1
  }

  // One transcription at a time; if audio arrives meanwhile, only the newest is
  // kept, so a slow laptop drops old audio instead of falling further behind.
  let busy = false
  let pending: Int16Array | null = null
  const pump = async (): Promise<void> => {
    if (busy || !pending) return
    busy = true
    const chunk = pending
    pending = null
    const started = Date.now()
    try {
      const text = await sidecar.transcribe(chunk)
      if (text) {
        emit({ type: 'transcript', text, ms: Date.now() - started })
        handleText(text, 'speech')
      }
    } catch (err) {
      console.error('[ai] transcription failed:', err)
    } finally {
      busy = false
      void pump()
    }
  }

  ipcMain.handle('ai:status', (e) => (isConsole(e.sender.id) ? sidecar.status : null))
  ipcMain.handle('ai:start', async (e) => {
    if (isConsole(e.sender.id)) await sidecar.start()
    return sidecar.status
  })
  ipcMain.handle('ai:stop', (e) => {
    if (isConsole(e.sender.id)) sidecar.stop()
    return sidecar.status
  })
  ipcMain.handle('ai:getMode', (e) => (isConsole(e.sender.id) ? deps.getMode() : 'suggest'))
  ipcMain.handle('ai:setMode', (e, mode: unknown) => {
    if (isConsole(e.sender.id) && isAiMode(mode)) deps.setMode(mode)
    return deps.getMode()
  })
  ipcMain.on('ai:audio', (e, data: unknown) => {
    if (!isConsole(e.sender.id)) return
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null
    if (!bytes || bytes.byteLength < 2 || bytes.byteLength > MAX_CHUNK_BYTES || bytes.byteLength % 2) return
    pending = new Int16Array(bytes.slice().buffer)
    void pump()
  })
  ipcMain.handle('ai:testText', (e, text: unknown) => {
    if (!isConsole(e.sender.id) || typeof text !== 'string') return 0
    return handleText(text.slice(0, 2000), 'typed')
  })
}

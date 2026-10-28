// IPC for scripture detection. Audio chunks from the console go to the whisper
// sidecar; transcripts go through the detector; suggestions go back to the
// console only. Nothing here can write to Preview or Live: the operator approves.

import { ipcMain, type BrowserWindow } from 'electron'
import type { ReferenceDetector } from '../ai/detector'
import type { WhisperSidecar } from '../ai/whisperSidecar'
import { parseReference, type ScriptureRef } from '../parser/reference'
import type { AiEvent, ServiceItem } from '../shared/types'

/** Longest chunk accepted: 10 s of 16 kHz 16-bit mono. */
const MAX_CHUNK_BYTES = 16_000 * 2 * 10

interface Deps {
  sidecar: WhisperSidecar
  detector: ReferenceDetector
  lookup: (ref: ScriptureRef) => ServiceItem | null
  /** Label of the scripture slide on Live, e.g. "John 3:16 (KJV)", if any. */
  liveLabel: () => string | undefined
  isConsole: (senderId: number) => boolean
  emit: (e: AiEvent) => void
}

export function registerAiIpc({ sidecar, detector, lookup, liveLabel, isConsole, emit }: Deps): void {
  let lastLive: string | undefined

  /** "verse eight" should mean the chapter on Live when the operator changes it. */
  const followLive = () => {
    const label = liveLabel()
    if (!label || label === lastLive) return
    lastLive = label
    const ref = parseReference(label.replace(/\s*\([^)]*\)\s*$/, ''))
    if (ref) detector.setContext({ book: ref.book, chapter: ref.chapter })
  }

  const handleText = (text: string, origin: 'speech' | 'typed'): number => {
    followLive()
    let count = 0
    for (const d of detector.feed(text, { complete: origin === 'typed' })) {
      const item = lookup(d.ref)
      if (!item) continue // e.g. "John 3:99": no such verse
      count++
      emit({
        type: 'suggestion',
        suggestion: { key: d.key, item, confidence: d.confidence, source: d.source, heard: d.heard, at: d.at, origin, replaces: d.replaces }
      })
    }
    return count
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

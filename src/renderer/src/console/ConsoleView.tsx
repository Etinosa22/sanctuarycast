import { useEffect, useRef, useState } from 'react'
import type { DisplaySummary, EngineAction, PresentationState, ServiceItem } from '../../../shared/types'
import { songToItem } from '../../../shared/lyrics'
import { SlideCanvas } from '../components/SlideCanvas'
import { formatElapsed, useEngineState, useNow, useService } from '../useEngineState'
import { LeftPanel, type LeftTab } from './LeftPanel'
import { chorusActions, itemIndexForKey, spaceActions, stepActions } from '../../../shared/navigation'
import { RightPanel } from './RightPanel'
import { freshCopy, type Selection } from './selection'
import { SlideStrip } from './SlideStrip'
import { SongEditor } from './SongEditor'
import { TopBar } from './TopBar'
import { useListening } from './useListening'
import { useTranslations } from './useTranslations'
import { Icon } from './icons'
import { isTyping, send, sendService } from './ui'

/** Edits Preview text. Keeps a local draft so the cursor doesn't jump while IPC round-trips. */
function PreviewEditor({ slideId, text }: { slideId: string | null; text: string }) {
  const [draft, setDraft] = useState(text)
  // Reset only when a different slide is staged, not on our own echoed edits.
  useEffect(() => setDraft(text), [slideId])
  return (
    <textarea
      disabled={!slideId}
      value={slideId ? draft : ''}
      onChange={(e) => {
        setDraft(e.target.value)
        send({ type: 'editPreview', text: e.target.value })
      }}
      placeholder="Fix a typo here before it goes live"
      title="Edits change Preview only. Ctrl+Enter sends Live while typing."
      className="h-16 w-full resize-none rounded-lg border border-white/5 bg-neutral-950/70 p-2 text-xs leading-relaxed text-neutral-200 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-40"
    />
  )
}

function PreviewLive({ state }: { state: PresentationState }) {
  const now = useNow()
  const mask = state.blanked ? 'BLANK' : state.logo ? 'LOGO' : state.clearText ? 'TEXT CLEARED' : null
  return (
    <div className="grid shrink-0 grid-cols-2 gap-4">
      <section className="card flex min-w-0 flex-col gap-2 p-2.5">
        <h2 className="flex items-center justify-between px-0.5 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/15 px-2 py-0.5 font-semibold tracking-wider text-amber-300 ring-1 ring-amber-400/25">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            PREVIEW
          </span>
          <span className="text-[11px] text-neutral-500">double-click or Enter to go live</span>
        </h2>
        <div
          className="aspect-video cursor-pointer overflow-hidden rounded-lg ring-2 ring-amber-400/60 shadow-[0_8px_30px_-12px_rgb(251_191_36/0.35)]"
          onDoubleClick={() => send({ type: 'goLive' })}
        >
          <SlideCanvas frame={state.preview} />
        </div>
        <PreviewEditor slideId={state.preview?.slide.id ?? null} text={state.preview?.slide.text ?? ''} />
      </section>

      <section className="card flex min-w-0 flex-col gap-2 p-2.5">
        <h2 className="flex items-center justify-between px-0.5 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 px-2 py-0.5 font-semibold tracking-wider text-rose-300 ring-1 ring-rose-400/25">
            <span className={`h-1.5 w-1.5 rounded-full bg-rose-400 ${state.live && !state.blanked ? 'live-dot' : ''}`} />
            LIVE
          </span>
          <span className="text-[11px] text-neutral-500 tabular-nums">
            {state.live && state.liveSince ? `on screen ${formatElapsed(now - state.liveSince)}` : 'nothing live'} · read-only
          </span>
        </h2>
        <div className="relative aspect-video overflow-hidden rounded-lg ring-2 ring-rose-500/70 shadow-[0_8px_30px_-12px_rgb(244_63_94/0.45)]">
          <SlideCanvas frame={state.live} masks={state} />
          {mask && (
            <span className="absolute top-2 left-2 rounded-md bg-rose-600/90 px-2 py-0.5 text-[11px] font-bold tracking-wider shadow-lg">{mask}</span>
          )}
        </div>
        <div className="h-16 overflow-y-auto rounded-lg border border-white/5 bg-neutral-950/40 p-2 text-xs leading-relaxed whitespace-pre-line text-neutral-400">
          {state.live?.slide.text ?? '—'}
        </div>
      </section>
    </div>
  )
}

function StatusBar() {
  const [displays, setDisplays] = useState<DisplaySummary | null>(null)
  useEffect(() => {
    const refresh = () => void window.sc.getDisplays().then(setDisplays)
    refresh()
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-white/5 bg-neutral-950/80 px-4 text-[11px] text-neutral-400">
      {displays && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="monitor" size={13} className="text-accent-400" />
            {displays.count} display{displays.count === 1 ? '' : 's'}
          </span>
          <span className={`inline-flex items-center gap-1.5 ${displays.mainOutput === 'closed' ? 'font-semibold text-rose-400' : ''}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${displays.mainOutput === 'closed' ? 'bg-rose-500' : 'bg-emerald-400'}`} />
            Main output: {displays.mainOutput}
          </span>
          <span>Stage: {displays.stageOutput}</span>
        </>
      )}
      <span className="flex-1 truncate text-center text-neutral-500">
        {[
          ['Space', 'send & next'],
          ['Enter', 'live'],
          ['B', 'blank'],
          ['C', 'chorus'],
          ['1–9', 'item'],
          ['← →', 'step'],
          ['Ctrl+F', 'search']
        ].map(([k, label]) => (
          <span key={k} className="mx-1.5 whitespace-nowrap">
            <kbd className="rounded-md border border-white/5 bg-neutral-800/80 px-1 py-px font-sans text-[10px] text-neutral-300">{k}</kbd> {label}
          </span>
        ))}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Auto-save on
      </span>
      <button className="rounded-md px-2 py-0.5 transition hover:bg-accent-500/15 hover:text-accent-200" onClick={() => void window.sc.reopenOutputs()}>
        Reopen outputs
      </button>
      <button className="rounded-md px-2 py-0.5 transition hover:bg-accent-500/15 hover:text-accent-200" onClick={() => void window.sc.openStage()}>
        Open stage display
      </button>
    </footer>
  )
}

/** Operator console: library tabs, Preview/Live, suggestions and backgrounds. */
export function ConsoleView() {
  const state = useEngineState<PresentationState>()
  const service = useService()
  const [tab, setTab] = useState<LeftTab>('service')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editing, setEditing] = useState<{ songId: string | null } | null>(null)
  const [songsVersion, setSongsVersion] = useState(0)
  const [bibleHistory, setBibleHistory] = useState<ServiceItem[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const translations = useTranslations()
  // When the detector shows a passage by itself, open it in the slide strip too.
  const listening = useListening((s) => setSelection({ source: 'bible', item: s.item }))

  // Open on the service item that is Live (e.g. after a crash), else Preview, else the first.
  useEffect(() => {
    if (!service || !state || selection) return
    const has = (id?: string) => (i: ServiceItem) => i.slides.some((s) => s.id === id)
    const start = service.items.find(has(state.live?.slide.id)) ?? service.items.find(has(state.preview?.slide.id)) ?? service.items[0]
    if (start) setSelection({ source: 'service', itemId: start.id })
  }, [service, state, selection])

  // The key handler is registered once; it reads the latest render through this ref.
  const latest = useRef({ state, service, shown: undefined as ServiceItem | undefined })

  useEffect(() => {
    const run = (actions: EngineAction[]) => actions.forEach(send)
    const onKey = (e: KeyboardEvent) => {
      // Dialogs (song and theme editors) own the keyboard while open.
      if (document.querySelector('[data-modal]')) return
      const { state: s, service: svc, shown: item } = latest.current
      if (!s || !svc) return

      if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        // Works even while typing in the Preview text box.
        e.preventDefault()
        send({ type: 'goLive' })
        return
      }
      if (isTyping(e.target) || e.ctrlKey || e.altKey || e.metaKey) return

      const slides = item?.slides ?? []
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const handled = ['Enter', ' ', 'b', 'c', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(key) || itemIndexForKey(key) !== null
      if (!handled) return
      // Stop a focused button from also being "clicked" by Space or Enter.
      e.preventDefault()
      // Holding a key down must not race through slides or flicker the blank.
      if (e.repeat && !key.startsWith('Arrow')) return

      if (key === 'Enter') send({ type: 'goLive' })
      else if (key === ' ') run(spaceActions(slides, s))
      else if (key === 'b') send({ type: 'toggleMask', mask: 'blank' })
      else if (key === 'c') run(chorusActions(slides, s))
      else if (key === 'ArrowRight' || key === 'ArrowDown') run(stepActions(slides, s, 1))
      else if (key === 'ArrowLeft' || key === 'ArrowUp') run(stepActions(slides, s, -1))
      else {
        const target = svc.items[itemIndexForKey(key)!]
        if (!target) return
        setSelection({ source: 'service', itemId: target.id })
        setTab('service')
        if (target.slides[0]) send({ type: 'stage', slide: target.slides[0] })
      }
    }
    // Space activates a focused button on key-up; cancel that too.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isTyping(e.target) && !document.querySelector('[data-modal]')) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  if (!state || !service) return <div className="p-6 text-neutral-400">Connecting to presentation engine…</div>

  const stageFirst = (item: ServiceItem) => item.slides[0] && send({ type: 'stage', slide: item.slides[0] })

  const openSong = async (songId: string, stage = false) => {
    const song = await window.sc.songs.get(songId)
    if (!song) return
    const item = songToItem(song, `song-${song.id}`)
    setSelection({ source: 'song', songId, item })
    if (stage) stageFirst(item)
  }

  const openPassage = (item: ServiceItem, stage = true) => {
    setSelection({ source: 'bible', item })
    setBibleHistory((h) => [item, ...h.filter((x) => x.title !== item.title)].slice(0, 30))
    if (stage) stageFirst(item)
  }

  const openRef = async (ref: string) => {
    const r = await window.sc.bible.search(ref)
    if (r.passage) openPassage(r.passage)
  }

  const addToService = () => {
    if (!selection || selection.source === 'service') return
    const item = freshCopy(selection.item)
    sendService({ type: 'addItem', item })
    setSelection({ source: 'service', itemId: item.id })
    setTab('service')
  }

  const shown = selection?.source === 'service' ? service.items.find((i) => i.id === selection.itemId) : selection?.item
  latest.current = { state, service, shown }

  /** Re-opens the shown passage in another translation; the slide in Preview follows, at the same position. */
  const switchTranslation = async (code: string) => {
    if (!shown?.scripture) return
    const r = await window.sc.bible.search(shown.scripture.ref, code)
    if (!r.passage) return
    const at = shown.slides.findIndex((s) => s.id === state.preview?.slide.id)
    openPassage(r.passage, false)
    if (at >= 0) send({ type: 'stage', slide: r.passage.slides[Math.min(at, r.passage.slides.length - 1)] })
  }

  return (
    <div className="console-bg flex h-screen flex-col font-sans text-neutral-100">
      <TopBar
        serviceTitle={service.title}
        searchRef={searchRef}
        actions={{
          onPassage: (item) => (openPassage(item), setTab('word')),
          onSong: (id) => (void openSong(id, true), setTab('songs')),
          onVerseRef: (ref) => (void openRef(ref), setTab('word'))
        }}
      />
      <div className="flex min-h-0 flex-1">
        <LeftPanel
          tab={tab}
          onTab={setTab}
          service={service}
          selection={selection}
          onSelectServiceItem={(itemId) => setSelection({ source: 'service', itemId })}
          previewSlideId={state.preview?.slide.id}
          liveSlideId={state.live?.slide.id}
          songsVersion={songsVersion}
          onOpenSong={(id) => void openSong(id)}
          onEditSong={(songId) => setEditing({ songId })}
          bibleHistory={bibleHistory}
          onOpenPassage={(item) => openPassage(item)}
          onSearchRef={(ref) => void openRef(ref)}
          translations={translations}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          <PreviewLive state={state} />
          <SlideStrip
            item={shown}
            state={state}
            onAddToService={selection && selection.source !== 'service' ? addToService : undefined}
            onEditSong={selection?.source === 'song' ? () => setEditing({ songId: selection.songId }) : undefined}
            translations={translations.enabled}
            onSwitchTranslation={(code) => void switchTranslation(code)}
          />
        </main>
        <RightPanel state={state} listening={listening} onApprove={(item) => (openPassage(item), setTab('word'))} />
      </div>
      <StatusBar />
      {editing && (
        <SongEditor
          songId={editing.songId}
          onClose={() => {
            setEditing(null)
            setSongsVersion((v) => v + 1)
            // The open song may have just been deleted.
            if (selection?.source === 'song') void window.sc.songs.get(selection.songId).then((s) => !s && setSelection(null))
          }}
          onSaved={(song) => {
            setEditing(null)
            setSongsVersion((v) => v + 1)
            setTab('songs')
            void openSong(song.id)
          }}
        />
      )}
    </div>
  )
}

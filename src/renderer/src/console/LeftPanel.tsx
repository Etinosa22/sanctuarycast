import { useEffect, useState, type ReactNode } from 'react'
import type { BibleSearchResult, ServiceItem, ServiceState, SongSummary } from '../../../shared/types'
import { ServiceOrderPanel } from './ServiceOrderPanel'
import type { Selection } from './selection'
import { Icon, type IconName } from './icons'
import { TranslationsPanel } from './TranslationsPanel'
import { LinkButton, PanelTitle } from './ui'
import type { Translations } from './useTranslations'

export type LeftTab = 'service' | 'songs' | 'word'

function SearchBox(props: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div className="px-2 pb-2">
      <input
        autoFocus={props.autoFocus}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && props.onChange('')}
        placeholder={props.placeholder}
        className="field w-full"
      />
    </div>
  )
}

function Row(props: { onClick: () => void; active?: boolean; title: string; sub?: string; right?: ReactNode }) {
  return (
    <li
      onClick={props.onClick}
      className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
        props.active ? 'border-accent-400/40 bg-accent-500/12 shadow-[inset_3px_0_0_var(--color-accent-400)]' : 'border-transparent hover:bg-white/[0.04]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{props.title}</div>
        {props.sub && <div className="truncate text-[11px] text-neutral-500">{props.sub}</div>}
      </div>
      {props.right}
    </li>
  )
}

function SongsTab(props: { version: number; selection: Selection | null; onOpenSong: (id: string) => void; onEditSong: (id: string | null) => void }) {
  const [filter, setFilter] = useState('')
  const [songs, setSongs] = useState<SongSummary[]>([])
  useEffect(() => {
    let current = true
    void window.sc.songs.list(filter).then((s) => current && setSongs(s))
    return () => {
      current = false
    }
  }, [filter, props.version])

  const openId = props.selection?.source === 'song' ? props.selection.songId : null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle icon="music" right={<LinkButton onClick={() => props.onEditSong(null)}>New song</LinkButton>}>
        Song library
      </PanelTitle>
      <SearchBox value={filter} onChange={setFilter} placeholder="Search song titles" autoFocus />
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {songs.map((s) => (
          <Row
            key={s.id}
            title={s.title}
            sub={s.author}
            active={s.id === openId}
            onClick={() => props.onOpenSong(s.id)}
            right={
              <button
                onClick={(e) => (e.stopPropagation(), props.onEditSong(s.id))}
                className="hidden rounded px-1.5 text-xs text-neutral-400 group-hover:block hover:bg-neutral-700 hover:text-white"
              >
                Edit
              </button>
            }
          />
        ))}
        {songs.length === 0 && (
          <li className="p-3 text-sm text-neutral-500">{filter ? `No song titled "${filter}".` : 'No songs yet. Click + New song and paste lyrics.'}</li>
        )}
      </ul>
    </div>
  )
}

function WordTab(props: {
  history: ServiceItem[]
  selection: Selection | null
  onOpenPassage: (item: ServiceItem) => void
  onSearchRef: (ref: string) => void
  translations: Translations
}) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<BibleSearchResult | null>(null)
  useEffect(() => {
    let current = true
    if (!query.trim()) return setResult(null)
    void window.sc.bible.search(query).then((r) => current && setResult(r))
    return () => {
      current = false
    }
    // Re-run when the main translation changes.
  }, [query, props.translations.main])

  const openTitle = props.selection?.source === 'bible' ? props.selection.item.title : null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle icon="book">Word · {props.translations.main}</PanelTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (result?.passage) props.onOpenPassage(result.passage)
        }}
      >
        <SearchBox value={query} onChange={setQuery} placeholder='"John 5:10", "Psalm 23", or words' autoFocus />
      </form>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {result?.passage && (
          <Row
            title={result.passage.title}
            sub={result.passage.slides[0]?.text}
            active={result.passage.title === openTitle}
            onClick={() => props.onOpenPassage(result.passage!)}
            right={<span className="text-[11px] text-accent-300">Enter</span>}
          />
        )}
        {query.trim() && !result?.passage && result?.hits.length === 0 && (
          <li className="p-3 text-sm text-neutral-500">No match. Try "John 5:10", "jn 5 10" or a few words from the verse.</li>
        )}
        {result?.hits.map((h) => <Row key={h.ref} title={h.ref} sub={h.text} onClick={() => props.onSearchRef(h.ref)} />)}

        {!query.trim() && (
          <>
            <li className="px-1 pt-1 text-[11px] tracking-wider text-neutral-500 uppercase">Opened this service</li>
            {props.history.map((item) => (
              <Row key={item.title} title={item.title} active={item.title === openTitle} onClick={() => props.onOpenPassage(item)} />
            ))}
            {props.history.length === 0 && <li className="p-3 text-sm text-neutral-500">Passages you open appear here.</li>}
          </>
        )}
      </ul>
      <TranslationsPanel t={props.translations} />
    </div>
  )
}

export function LeftPanel(props: {
  tab: LeftTab
  onTab: (t: LeftTab) => void
  service: ServiceState
  selection: Selection | null
  onSelectServiceItem: (id: string) => void
  previewSlideId?: string
  liveSlideId?: string
  songsVersion: number
  onOpenSong: (id: string) => void
  onEditSong: (id: string | null) => void
  bibleHistory: ServiceItem[]
  onOpenPassage: (item: ServiceItem) => void
  onSearchRef: (ref: string) => void
  translations: Translations
}) {
  const tabs: [LeftTab, string, IconName][] = [
    ['service', 'Service', 'list'],
    ['songs', 'Songs', 'music'],
    ['word', 'Word', 'book']
  ]
  return (
    <aside className="panel flex w-64 shrink-0 flex-col border-y-0 border-l-0">
      <div className="m-2 mb-0 flex gap-1 rounded-xl bg-neutral-950/70 p-1 ring-1 ring-white/5" role="tablist">
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={props.tab === key}
            onClick={() => props.onTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[13px] font-medium transition ${
              props.tab === key
                ? 'bg-gradient-to-b from-accent-500/40 to-accent-700/35 text-white shadow-sm ring-1 ring-accent-300/25'
                : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
            }`}
          >
            <Icon name={icon} size={14} />
            {label}
          </button>
        ))}
      </div>
      {props.tab === 'service' && (
        <ServiceOrderPanel
          service={props.service}
          selectedId={props.selection?.source === 'service' ? props.selection.itemId : null}
          onSelect={props.onSelectServiceItem}
          previewSlideId={props.previewSlideId}
          liveSlideId={props.liveSlideId}
        />
      )}
      {props.tab === 'songs' && (
        <SongsTab version={props.songsVersion} selection={props.selection} onOpenSong={props.onOpenSong} onEditSong={props.onEditSong} />
      )}
      {props.tab === 'word' && (
        <WordTab
          history={props.bibleHistory}
          selection={props.selection}
          onOpenPassage={props.onOpenPassage}
          onSearchRef={props.onSearchRef}
          translations={props.translations}
        />
      )}
    </aside>
  )
}

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ServiceItem, SongSummary } from '../../../shared/types'
import { Icon, Logo } from './icons'

type Result =
  | { kind: 'passage'; item: ServiceItem }
  | { kind: 'song'; song: SongSummary }
  | { kind: 'verse'; ref: string; text: string }

export interface SearchActions {
  onPassage: (item: ServiceItem) => void
  onSong: (id: string) => void
  onVerseRef: (ref: string) => void
}

/**
 * One box for both: a Bible reference ("John 5:10") or a saved song title.
 * Words that are neither also search verse text. Picking a result puts it in Preview.
 */
export function TopBar({ serviceTitle, searchRef, actions }: { serviceTitle: string; searchRef: RefObject<HTMLInputElement | null>; actions: SearchActions }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const latest = useRef(0)

  useEffect(() => {
    const q = query.trim()
    const ticket = ++latest.current
    if (!q) return setResults([])
    void Promise.all([window.sc.bible.search(q), q.length >= 2 ? window.sc.songs.list(q) : Promise.resolve([])]).then(([bible, songs]) => {
      if (ticket !== latest.current) return // a newer keystroke already answered
      const next: Result[] = []
      if (bible.passage) next.push({ kind: 'passage', item: bible.passage })
      next.push(...songs.slice(0, 6).map((song): Result => ({ kind: 'song', song })))
      if (!bible.passage) next.push(...bible.hits.slice(0, 6).map((h): Result => ({ kind: 'verse', ...h })))
      setResults(next)
      setActive(0)
    })
  }, [query])

  const pick = (r: Result | undefined) => {
    if (!r) return
    if (r.kind === 'passage') actions.onPassage(r.item)
    else if (r.kind === 'song') actions.onSong(r.song.id)
    else actions.onVerseRef(r.ref)
    setOpen(false)
    searchRef.current?.blur()
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/5 bg-neutral-950/60 px-4">
      <div className="flex w-56 shrink-0 items-center gap-2.5">
        <Logo size={30} />
        <div className="min-w-0">
          <div className="brand-text text-[15px] leading-tight font-semibold tracking-tight">SanctuaryCast</div>
          <div className="truncate text-[11px] text-neutral-400">{serviceTitle}</div>
        </div>
      </div>

      <div className="relative max-w-2xl flex-1">
        <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-500" />
        <input
          ref={searchRef}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => (setQuery(e.target.value), setOpen(true))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)))
            else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
            else if (e.key === 'Enter') (e.preventDefault(), pick(results[active]))
            else if (e.key === 'Escape') (setQuery(''), e.currentTarget.blur())
          }}
          placeholder='Search Bible or songs: "John 5:10", "Psalm 23", "Amazing Grace"   (Ctrl+F)'
          className="field h-9 w-full rounded-xl pl-9"
        />
        {open && query.trim() && (
          <ul className="absolute top-11 right-0 left-0 z-40 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 py-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.8)]">
            {results.map((r, i) => {
              const [tag, tagClass, title, sub] =
                r.kind === 'passage'
                  ? ['Bible', 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20', r.item.title, r.item.slides[0]?.text]
                  : r.kind === 'song'
                    ? ['Song', 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20', r.song.title, r.song.author]
                    : ['Verse', 'bg-neutral-700/60 text-neutral-300 ring-1 ring-white/10', r.ref, r.text]
              return (
                <li
                  key={i}
                  onMouseDown={(e) => (e.preventDefault(), pick(r))}
                  onMouseEnter={() => setActive(i)}
                  className={`mx-1.5 flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 ${i === active ? 'bg-accent-500/15' : ''}`}
                >
                  <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-px text-[10px] font-medium ${tagClass}`}>{tag}</span>
                  <div className="min-w-0">
                    <div className="text-sm">{title}</div>
                    {sub && <div className="line-clamp-1 text-xs text-neutral-500">{sub}</div>}
                  </div>
                  {i === active && <span className="ml-auto shrink-0 text-[11px] text-neutral-500">Enter → Preview</span>}
                </li>
              )
            })}
            {results.length === 0 && <li className="px-3 py-2 text-sm text-neutral-500">No Bible reference or song title matches "{query}".</li>}
          </ul>
        )}
      </div>
    </header>
  )
}

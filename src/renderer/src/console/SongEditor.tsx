import { useEffect, useMemo, useState } from 'react'
import type { Song } from '../../../shared/types'
import { joinLyrics, parseArrangement, sectionName, splitLyrics } from '../../../shared/lyrics'

const EXAMPLE = `Verse 1
Paste the first verse here

Chorus
The chorus goes here

Verse 2
Then the next verse`

/** New or existing song: paste lyrics, check the auto-split, set the arrangement. */
export function SongEditor({ songId, onClose, onSaved }: { songId: string | null; onClose: () => void; onSaved: (song: Song) => void }) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [ccli, setCcli] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [arrangementText, setArrangementText] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(songId === null)

  useEffect(() => {
    if (!songId) return
    void window.sc.songs.get(songId).then((s) => {
      if (s) {
        setTitle(s.title)
        setAuthor(s.author)
        setCcli(s.ccli)
        setLyrics(joinLyrics(s.sections))
        setArrangementText(s.arrangement.join(', '))
      }
      setLoaded(true)
    })
  }, [songId])

  const split = useMemo(() => splitLyrics(lyrics), [lyrics])
  // Until the operator types an arrangement, follow the paste order.
  const arrangement = arrangementText === null ? split.arrangement : parseArrangement(arrangementText, split.sections)

  const save = async () => {
    if (!title.trim()) return setError('Give the song a title; it is what you search for.')
    if (split.sections.length === 0) return setError('Paste the lyrics first.')
    try {
      const song = await window.sc.songs.save({ id: songId ?? undefined, title, author, ccli, sections: split.sections, arrangement })
      onSaved(song)
    } catch (e) {
      setError(String(e))
    }
  }

  const remove = async () => {
    if (!songId || !window.confirm(`Delete "${title}" from the song library? Services that already use it keep their copy.`)) return
    await window.sc.songs.remove(songId)
    onClose()
  }

  if (!loaded) return null

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-[#03050d]/80 p-6" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-[0_40px_100px_-20px_rgb(0_0_0/0.9)]">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="font-semibold">{songId ? 'Edit song' : 'New song'}</h2>
          <button onClick={onClose} className="rounded px-2 text-neutral-400 hover:bg-neutral-800 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px] gap-4 overflow-hidden p-4">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (required)" className="field" />
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" className="field" />
              <input value={ccli} onChange={(e) => setCcli(e.target.value)} placeholder="CCLI number" className="field" />
            </div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={EXAMPLE}
              className="field min-h-64 flex-1 resize-none font-mono text-[13px] leading-relaxed"
            />
            <p className="text-xs text-neutral-500">
              Leave a blank line between sections. Headers like "Verse 2", "Chorus" or "[Bridge]" label the section below them; a stanza
              pasted twice is treated as the chorus.
            </p>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <label className="text-xs text-neutral-400">
              Arrangement (order sung)
              <input
                value={arrangementText ?? split.arrangement.join(', ')}
                onChange={(e) => setArrangementText(e.target.value)}
                placeholder="V1, C, V2, C, B, C"
                className="field mt-1 w-full"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {arrangement.map((l, i) => (
                <span key={i} className="rounded bg-sky-900/70 px-1.5 text-xs text-sky-200">
                  {l}
                </span>
              ))}
            </div>
            <div className="text-xs text-neutral-400">Detected sections</div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {split.sections.map((s) => (
                <div key={s.label} className="rounded border border-neutral-800 bg-neutral-950 p-2 text-xs">
                  <div className="mb-1 font-semibold text-sky-300">
                    {s.label} · {sectionName(s.label)}
                  </div>
                  <div className="whitespace-pre-line text-neutral-300">{s.text}</div>
                </div>
              ))}
              {split.sections.length === 0 && <div className="text-xs text-neutral-600">Sections appear here as you paste.</div>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-3">
          {songId && (
            <button onClick={remove} className="rounded px-3 py-1.5 text-sm text-red-300 hover:bg-red-900/50">
              Delete song
            </button>
          )}
          <span className="flex-1 text-sm text-red-400">{error}</span>
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            Cancel
          </button>
          <button onClick={save} className="btn-accent rounded-lg px-4 py-1.5 text-sm font-semibold">
            Save song
          </button>
        </div>
      </div>
    </div>
  )
}

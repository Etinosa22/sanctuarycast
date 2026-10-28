import { useEffect, useRef, useState } from 'react'
import type { Background, LibraryBackground, PresentationState, SavedTheme, Theme } from '../../../shared/types'
import { BackgroundLayer } from '../components/SlideCanvas'
import { ThemeEditor } from './ThemeEditor'
import { ControlButton, PanelTitle, send } from './ui'

function SuggestionFeed() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PanelTitle right={<span className="rounded bg-neutral-800 px-1.5 text-[11px] text-neutral-400">Listening off</span>}>
        Scripture suggestions
      </PanelTitle>
      <div className="mx-3 flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-neutral-700 p-4 text-center text-sm text-neutral-500">
        <p>When the preacher mentions a verse, a card appears here.</p>
        <p className="mt-2">Approve it to put it in Preview. Nothing goes Live without you.</p>
        <p className="mt-3 text-[11px] text-neutral-600">Speech detection is Phase 2.</p>
      </div>
    </section>
  )
}

function LiveControls({ state }: { state: PresentationState }) {
  return (
    <section>
      <PanelTitle>Live control</PanelTitle>
      <div className="grid grid-cols-2 gap-2 px-3">
        <ControlButton tone="go" hint="Enter" className="col-span-2 py-3 text-base" onClick={() => send({ type: 'goLive' })}>
          Go Live
        </ControlButton>
        <ControlButton hint="B" active={state.blanked} onClick={() => send({ type: 'toggleMask', mask: 'blank' })}>
          Blank
        </ControlButton>
        <ControlButton active={state.logo} onClick={() => send({ type: 'toggleMask', mask: 'logo' })}>
          Logo
        </ControlButton>
        <ControlButton active={state.clearText} onClick={() => send({ type: 'toggleMask', mask: 'clearText' })}>
          Clear text
        </ControlButton>
        <ControlButton onClick={() => send({ type: 'unmask' })}>Show again</ControlButton>
        <ControlButton tone="danger" className="col-span-2" onClick={() => send({ type: 'clearLive' })}>
          Clear Live slide
        </ControlButton>
      </div>
    </section>
  )
}

const same = (a: Background | undefined, b: Background) => JSON.stringify(a) === JSON.stringify(b)

/** Field-by-field compare, so key order in saved JSON doesn't matter. */
const sameTheme = (a: Theme, b: Theme) => (Object.keys(a) as (keyof Theme)[]).every((k) => a[k] === b[k])

function ThemeBar({ state }: { state: PresentationState }) {
  const [themes, setThemes] = useState<SavedTheme[]>([])
  const [editing, setEditing] = useState(false)
  const refresh = () => void window.sc.themes.list().then(setThemes)
  useEffect(refresh, [])

  const current = state.preview?.theme ?? state.theme
  const match = themes.find((t) => sameTheme(t.theme, current))

  const remove = async () => {
    if (!match || match.builtIn || !window.confirm(`Delete theme "${match.name}"? Slides already using it keep their look.`)) return
    await window.sc.themes.remove(match.id)
    refresh()
  }

  return (
    <section>
      <PanelTitle>Theme → Preview</PanelTitle>
      <div className="flex gap-2 px-3">
        <select
          value={match?.id ?? ''}
          onChange={(e) => {
            const t = themes.find((x) => x.id === e.target.value)
            if (t) send({ type: 'setTheme', theme: t.theme })
          }}
          className="field min-w-0 flex-1"
        >
          {!match && <option value="">Custom (unsaved)</option>}
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {match && !match.builtIn && (
          <button onClick={() => void remove()} title="Delete this saved theme" className="rounded px-2 text-neutral-400 hover:bg-red-800 hover:text-white">
            ×
          </button>
        )}
        <button onClick={() => setEditing(true)} className="rounded bg-neutral-700 px-3 text-sm hover:bg-neutral-600">
          Edit…
        </button>
      </div>
      {editing && <ThemeEditor state={state} onClose={() => (setEditing(false), refresh())} onSaved={refresh} />}
    </section>
  )
}

function BackgroundBar({ state }: { state: PresentationState }) {
  const [items, setItems] = useState<LibraryBackground[]>([])
  const colourInput = useRef<HTMLInputElement>(null)
  const refresh = () => void window.sc.backgrounds.list().then(setItems)
  useEffect(refresh, [])

  const current = state.preview?.background ?? state.background

  const importFiles = async () => {
    const added = await window.sc.backgrounds.importFiles()
    refresh()
    // A single new background goes straight to Preview so you can see it.
    if (added.length === 1) send({ type: 'setBackground', background: added[0].background })
  }

  const addColour = async (colour: string) => {
    const added = await window.sc.backgrounds.addColour(colour)
    refresh()
    send({ type: 'setBackground', background: added.background })
  }

  // The native change event fires once when the picker closes; React's onChange
  // fires on every drag step and would add dozens of colours.
  useEffect(() => {
    const el = colourInput.current
    if (!el) return
    const onChange = () => void addColour(el.value)
    el.addEventListener('change', onChange)
    return () => el.removeEventListener('change', onChange)
  })

  const remove = async (b: LibraryBackground) => {
    if (!window.confirm(`Remove background "${b.name}"?`)) return
    const r = await window.sc.backgrounds.remove(b.id)
    if (!r.ok) window.alert(r.reason)
    refresh()
  }

  return (
    <section className="pb-3">
      <PanelTitle
        right={
          <div className="flex gap-1">
            <button onClick={importFiles} className="rounded px-1.5 text-xs text-amber-300 hover:bg-neutral-800" title="Import JPG, PNG, WebP, MP4 or WebM">
              + Image/Video
            </button>
            <button onClick={() => colourInput.current?.click()} className="rounded px-1.5 text-xs text-amber-300 hover:bg-neutral-800">
              + Colour
            </button>
            <input ref={colourInput} type="color" defaultValue="#1e3a8a" className="hidden" />
          </div>
        }
      >
        Background
      </PanelTitle>
      <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto px-3 py-1">
        {items.map((b) => (
          <div key={b.id} className="group relative">
            <button
              title={`${b.name}${b.background.kind === 'video' ? ' (video)' : ''}`}
              onClick={() => send({ type: 'setBackground', background: b.background })}
              className={`relative block aspect-video w-full overflow-hidden rounded ${
                same(current, b.background) ? 'ring-2 ring-amber-400' : 'ring-1 ring-neutral-600 hover:ring-neutral-400'
              }`}
            >
              <BackgroundLayer background={b.background} />
              {b.background.kind === 'video' && <span className="absolute right-0.5 bottom-0.5 rounded bg-black/70 px-1 text-[9px]">▶</span>}
            </button>
            {!b.builtIn && (
              <button
                onClick={() => void remove(b)}
                title="Remove background"
                className="absolute -top-1.5 -right-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] group-hover:flex hover:bg-red-700"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] text-neutral-500">Changes Preview only; Go Live to show it.</p>
    </section>
  )
}

export function RightPanel({ state }: { state: PresentationState }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-1 border-l border-neutral-800 bg-neutral-950/40">
      <SuggestionFeed />
      <LiveControls state={state} />
      <ThemeBar state={state} />
      <BackgroundBar state={state} />
    </aside>
  )
}

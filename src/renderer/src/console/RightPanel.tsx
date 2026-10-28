import { useEffect, useRef, useState } from 'react'
import type { Background, LibraryBackground, PresentationState, SavedTheme, ServiceItem, Theme } from '../../../shared/types'
import { BackgroundLayer } from '../components/SlideCanvas'
import { AiPanel } from './AiPanel'
import { ThemeEditor } from './ThemeEditor'
import { Icon } from './icons'
import { ControlButton, LinkButton, PanelTitle, send } from './ui'
import type { Listening } from './useListening'

function LiveControls({ state }: { state: PresentationState }) {
  return (
    <section>
      <PanelTitle icon="monitor">Live control</PanelTitle>
      <div className="grid grid-cols-2 gap-2 px-3">
        <ControlButton tone="go" hint="Enter" className="col-span-2 py-3 text-base font-semibold" onClick={() => send({ type: 'goLive' })}>
          Go Live
        </ControlButton>
        <ControlButton hint="B" icon="eyeOff" active={state.blanked} onClick={() => send({ type: 'toggleMask', mask: 'blank' })}>
          Blank
        </ControlButton>
        <ControlButton icon="cross" active={state.logo} onClick={() => send({ type: 'toggleMask', mask: 'logo' })}>
          Logo
        </ControlButton>
        <ControlButton icon="type" active={state.clearText} onClick={() => send({ type: 'toggleMask', mask: 'clearText' })}>
          Clear text
        </ControlButton>
        <ControlButton onClick={() => send({ type: 'unmask' })}>Show again</ControlButton>
        <ControlButton tone="danger" icon="x" className="col-span-2" onClick={() => send({ type: 'clearLive' })}>
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
      <PanelTitle icon="palette">Theme → Preview</PanelTitle>
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
          <button onClick={() => void remove()} title="Delete this saved theme" className="rounded-lg px-2 text-neutral-400 transition hover:bg-rose-900/70 hover:text-white">
            <Icon name="x" size={13} />
          </button>
        )}
        <button onClick={() => setEditing(true)} className="btn-accent inline-flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium">
          <Icon name="edit" size={13} />
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
        icon="image"
        right={
          <div className="flex gap-0.5">
            <LinkButton onClick={() => void importFiles()} title="Import JPG, PNG, WebP, MP4 or WebM">
              Image/Video
            </LinkButton>
            <LinkButton onClick={() => colourInput.current?.click()}>Colour</LinkButton>
            <input ref={colourInput} type="color" defaultValue="#1e3a8a" className="hidden" />
          </div>
        }
      >
        Background
      </PanelTitle>
      <div className="grid max-h-32 grid-cols-3 gap-2 overflow-y-auto px-3 py-1">
        {items.map((b) => (
          <div key={b.id} className="group relative">
            <button
              title={`${b.name}${b.background.kind === 'video' ? ' (video)' : ''}`}
              onClick={() => send({ type: 'setBackground', background: b.background })}
              className={`relative block aspect-video w-full overflow-hidden rounded-lg transition ${
                same(current, b.background) ? 'ring-2 ring-accent-400 ring-offset-2 ring-offset-neutral-900' : 'ring-1 ring-white/10 hover:ring-accent-400/50'
              }`}
            >
              <BackgroundLayer background={b.background} />
              {b.background.kind === 'video' && (
                <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[9px] font-semibold tracking-wide">VIDEO</span>
              )}
            </button>
            {!b.builtIn && (
              <button
                onClick={() => void remove(b)}
                title="Remove background"
                className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-neutral-800 shadow ring-1 ring-white/10 group-hover:flex hover:bg-rose-700"
              >
                <Icon name="x" size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] text-neutral-500">Changes Preview only; Go Live to show it.</p>
    </section>
  )
}

export function RightPanel({ state, listening, onApprove }: { state: PresentationState; listening: Listening; onApprove: (item: ServiceItem) => void }) {
  return (
    <aside className="panel flex w-72 shrink-0 flex-col gap-1 overflow-y-auto border-y-0 border-r-0">
      <AiPanel l={listening} onApprove={onApprove} />
      <LiveControls state={state} />
      <ThemeBar state={state} />
      <BackgroundBar state={state} />
    </aside>
  )
}

import { useState, type ReactNode } from 'react'
import type { Frame, PresentationState, SavedTheme, Slide, TextAlign, TextPosition, Theme } from '../../../shared/types'
import { SlideCanvas } from '../components/SlideCanvas'
import { send } from './ui'

// Fonts that ship with Windows 10 and/or macOS, so they work offline on any church laptop.
const FONTS: [label: string, stack: string][] = [
  ['Segoe UI', 'Segoe UI, Helvetica Neue, Arial, sans-serif'],
  ['Arial', 'Arial, Helvetica, sans-serif'],
  ['Calibri', 'Calibri, Carlito, Arial, sans-serif'],
  ['Verdana', 'Verdana, Geneva, sans-serif'],
  ['Tahoma', 'Tahoma, Verdana, sans-serif'],
  ['Trebuchet MS', '"Trebuchet MS", Helvetica, sans-serif'],
  ['Arial Black', '"Arial Black", "Arial Bold", Gadget, sans-serif'],
  ['Impact', 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'],
  ['Georgia', 'Georgia, Cambria, "Times New Roman", serif'],
  ['Cambria', 'Cambria, Georgia, serif'],
  ['Times New Roman', '"Times New Roman", Times, serif'],
  ['Palatino', '"Palatino Linotype", Palatino, "Book Antiqua", serif']
]

const SAMPLES: Record<'song' | 'scripture', Slide> = {
  song: { id: 'sample-song', kind: 'song', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.' },
  scripture: {
    id: 'sample-scripture',
    kind: 'scripture',
    label: 'John 3:16 (KJV)',
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md ring-1 ring-neutral-700">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 text-xs ${value === v ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Slider(props: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="flex-1 accent-amber-500"
      />
      <span className="w-14 text-right text-xs text-neutral-300 tabular-nums">
        {props.value}
        {props.unit ?? 'px'}
      </span>
    </div>
  )
}

/**
 * Edits the look of Preview (and of slides staged after it). Live is never
 * touched: send the slide live to show the new look on the projector.
 */
export function ThemeEditor({ state, onClose, onSaved }: { state: PresentationState; onClose: () => void; onSaved: (t: SavedTheme) => void }) {
  const [original] = useState<Theme>(() => state.preview?.theme ?? state.theme)
  const [draft, setDraft] = useState<Theme>(original)
  const [sample, setSample] = useState<'preview' | 'song' | 'scripture'>(state.preview ? 'preview' : 'song')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const change = (patch: Partial<Theme>) => {
    setDraft((d) => ({ ...d, ...patch }))
    send({ type: 'setTheme', theme: patch })
    setMessage('')
  }

  const replaceAll = (theme: Theme) => {
    setDraft(theme)
    send({ type: 'setTheme', theme })
  }

  const cancel = () => {
    replaceAll(original)
    onClose()
  }

  const save = async () => {
    try {
      const saved = await window.sc.themes.save(name, draft)
      setMessage(`Saved "${saved.name}"`)
      onSaved(saved)
    } catch (e) {
      setMessage(String(e).replace(/^Error: (Error invoking remote method '[^']+': )?(Error: )?/, ''))
    }
  }

  const slide = sample === 'preview' && state.preview ? state.preview.slide : SAMPLES[sample === 'scripture' ? 'scripture' : 'song']
  const frame: Frame = { slide, background: state.preview?.background ?? state.background, theme: draft }
  const fontValue = FONTS.find(([, stack]) => stack === draft.fontFamily)?.[1] ?? draft.fontFamily

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onKeyDown={(e) => e.key === 'Escape' && cancel()}>
      <div className="flex max-h-full w-full max-w-6xl flex-col rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="font-semibold">Theme</h2>
            <p className="text-xs text-neutral-500">Changes show in Preview as you make them. Live stays as it is until you send a slide.</p>
          </div>
          <button onClick={cancel} className="rounded px-2 text-neutral-400 hover:bg-neutral-800 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-5 overflow-y-auto p-4">
          <div className="space-y-2">
            <div className="relative aspect-video overflow-hidden rounded ring-2 ring-amber-400/70">
              <SlideCanvas frame={frame} />
              {/* Safe margin guide, scaled from the 1920x1080 canvas. */}
              <div
                className="pointer-events-none absolute border border-dashed border-white/30"
                style={{
                  left: `${(draft.margin / 1920) * 100}%`,
                  right: `${(draft.margin / 1920) * 100}%`,
                  top: `${(draft.margin / 1080) * 100}%`,
                  bottom: `${(draft.margin / 1080) * 100}%`
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Show</span>
              <Segmented
                value={sample}
                onChange={setSample}
                options={[
                  ...(state.preview ? ([['preview', 'Preview slide']] as ['preview', string][]) : []),
                  ['song', 'Song sample'],
                  ['scripture', 'Scripture sample']
                ]}
              />
              <span className="ml-auto">Dashed line: safe margin</span>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Font">
              <select value={fontValue} onChange={(e) => change({ fontFamily: e.target.value })} className="field w-full">
                {FONTS.map(([label, stack]) => (
                  <option key={label} value={stack} style={{ fontFamily: stack }}>
                    {label}
                  </option>
                ))}
                {!FONTS.some(([, s]) => s === draft.fontFamily) && <option value={draft.fontFamily}>Custom</option>}
              </select>
            </Field>
            <Field label="Text size (on a 1080p screen)">
              <Slider value={draft.fontSize} min={24} max={160} onChange={(fontSize) => change({ fontSize })} />
            </Field>
            <Field label="Text colour">
              <div className="flex items-center gap-2">
                <input type="color" value={draft.colour} onChange={(e) => change({ colour: e.target.value })} className="h-8 w-12 cursor-pointer rounded bg-transparent" />
                <span className="text-xs text-neutral-400 uppercase">{draft.colour}</span>
              </div>
            </Field>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.shadow} onChange={(e) => change({ shadow: e.target.checked })} className="accent-amber-500" />
                Shadow
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.outline} onChange={(e) => change({ outline: e.target.checked })} className="accent-amber-500" />
                Outline
              </label>
            </div>
            <Field label="Alignment">
              <Segmented<TextAlign>
                value={draft.align}
                onChange={(align) => change({ align })}
                options={[
                  ['left', 'Left'],
                  ['center', 'Centre'],
                  ['right', 'Right']
                ]}
              />
            </Field>
            <Field label="Position">
              <Segmented<TextPosition>
                value={draft.position}
                onChange={(position) => change({ position })}
                options={[
                  ['top', 'Top'],
                  ['middle', 'Middle'],
                  ['bottom', 'Bottom']
                ]}
              />
            </Field>
            <Field label="Safe margin">
              <Slider value={draft.margin} min={0} max={300} step={4} onChange={(margin) => change({ margin })} />
            </Field>

            <div className="space-y-2 border-t border-neutral-800 pt-3">
              <span className="text-xs text-neutral-400">Save for reuse</span>
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Theme name" className="field min-w-0 flex-1" />
                <button onClick={save} className="rounded bg-neutral-700 px-3 text-sm hover:bg-neutral-600">
                  Save
                </button>
              </div>
              {message && <p className="text-xs text-amber-300">{message}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-3">
          <button onClick={() => replaceAll(original)} className="rounded px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            Undo changes
          </button>
          <span className="flex-1" />
          <button onClick={cancel} className="rounded px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            Cancel
          </button>
          <button onClick={onClose} className="rounded bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

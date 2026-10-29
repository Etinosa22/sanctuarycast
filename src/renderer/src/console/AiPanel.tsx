import { useState } from 'react'
import type { AiMode, ServiceItem } from '../../../shared/types'
import { Icon } from './icons'
import { PanelTitle } from './ui'
import type { Listening } from './useListening'

function LevelMeter({ level, active }: { level: number; active: boolean }) {
  // Green is comfortable speech; red means the input is clipping.
  const colour = level > 0.85 ? 'bg-rose-500' : level > 0.15 ? 'bg-emerald-400' : 'bg-amber-400'
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-950/80 ring-1 ring-white/5" title="Input level">
      <div className={`h-full rounded-full transition-[width] duration-75 ${active ? colour : 'bg-neutral-700'}`} style={{ width: `${Math.round((active ? level : 0) * 100)}%` }} />
    </div>
  )
}

const MODES: [AiMode, string, string][] = [
  ['suggest', 'Suggest', 'Cards only: you send each verse to Preview yourself'],
  ['preview', 'Auto Preview', 'Found verses go straight to Preview for you to review (never Live)'],
  ['live', 'Auto Live', 'Sure detections go to Preview AND the projector without asking']
]

function ModeSwitch({ mode, onChange }: { mode: AiMode; onChange: (m: AiMode) => void }) {
  const pick = (m: AiMode) => {
    if (m === mode) return
    if (
      m === 'live' &&
      !window.confirm(
        'Turn on Auto Live?\n\nWhen the preacher clearly says a reference or recites a verse word for word, it will go on the projector straight away without your approval. Less certain detections still go to Preview only.\n\nKeep a hand on Blank (B) in case it gets one wrong.'
      )
    )
      return
    onChange(m)
  }
  return (
    <div className="flex gap-0.5 rounded-lg bg-neutral-950/70 p-0.5 ring-1 ring-white/5" role="radiogroup" aria-label="What to do with detected verses">
      {MODES.map(([m, label, hint]) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          title={hint}
          onClick={() => pick(m)}
          className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition ${
            mode === m
              ? m === 'live'
                ? 'bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-[0_0_12px_-2px_rgb(244_63_94/0.7)]'
                : 'bg-accent-600 text-white'
              : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Bluetooth headset microphones run in narrowband "hands-free" mode on Windows. */
const isHeadset = (label: string) => /headset|hands-?free|bluetooth|airpods|buds/i.test(label)

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000)
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}

/** Scripture suggestions: pick the input, listen, approve detected verses into Preview. */
export function AiPanel({ l, onApprove }: { l: Listening; onApprove: (item: ServiceItem) => void }) {
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [typedResult, setTypedResult] = useState('')

  const engineMissing = l.status.state === 'missing'
  // "Default input" is whatever Windows uses; its label is on the 'default' entry.
  const selectedLabel = (l.devices.find((d) => d.deviceId === (l.deviceId || 'default')) ?? l.devices[0])?.label ?? ''
  const statusDot =
    l.mode === 'listen' && l.status.state === 'ready'
      ? 'live-dot bg-rose-500'
      : l.status.state === 'starting'
        ? 'bg-amber-400'
        : l.status.state === 'error' || engineMissing
          ? 'bg-rose-600'
          : 'bg-neutral-500'
  const statusText =
    l.mode === 'listen'
      ? l.status.state === 'ready'
        ? 'Listening'
        : l.status.state === 'starting'
          ? 'Loading…'
          : 'Not ready'
      : l.mode === 'test'
        ? 'Mic test'
        : 'Listening off'

  const runTyped = async () => {
    const n = await l.testText(text)
    setTypedResult(n ? `${n} reference${n === 1 ? '' : 's'} found` : 'No reference found in that text')
  }

  return (
    <section className="flex flex-1 flex-col">
      <PanelTitle
        icon="sparkles"
        right={
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800/80 px-2 py-px text-[10px] text-neutral-300 ring-1 ring-white/5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            {statusText}
          </span>
        }
      >
        Scripture suggestions
      </PanelTitle>

      {/* Audio input */}
      <div className="mx-3 space-y-1.5 rounded-xl bg-neutral-950/50 p-2 ring-1 ring-white/5">
        <div className="flex gap-1.5">
          <select
            value={l.deviceId}
            onChange={(e) => l.setDeviceId(e.target.value)}
            title="Audio input: the preacher's microphone or a feed from the mixer"
            className="field min-w-0 flex-1 py-1 text-xs"
          >
            <option value="">Default input</option>
            {l.devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Input ${i + 1}`}
              </option>
            ))}
          </select>
          {l.mode === 'off' ? (
            <>
              <button onClick={() => void l.test()} className="rounded-lg bg-neutral-800/80 px-2 text-xs text-neutral-200 ring-1 ring-white/5 hover:bg-neutral-700" title="Check the level without listening">
                Test mic
              </button>
              <button
                onClick={() => void l.listen()}
                disabled={engineMissing}
                className="btn-accent rounded-lg px-2.5 text-xs font-semibold"
                title={engineMissing ? l.status.message : 'Start listening for scripture'}
              >
                Listen
              </button>
            </>
          ) : (
            <button onClick={l.stop} className="rounded-lg bg-rose-600/90 px-2.5 text-xs font-semibold text-white hover:bg-rose-500">
              Stop
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Icon name="sparkles" size={12} className={l.mode !== 'off' ? 'text-emerald-400' : 'text-neutral-600'} />
          <LevelMeter level={l.level} active={l.mode !== 'off'} />
        </div>
        <ModeSwitch mode={l.aiMode} onChange={(m) => void l.setAiMode(m)} />
        {isHeadset(selectedLabel) && (
          <p className="text-[11px] text-amber-300">
            Bluetooth headset mics switch to phone-call quality and are hard to understand. Use the laptop mic, a USB/wired mic or the mixer feed.
          </p>
        )}
        {(l.error || engineMissing || l.status.state === 'error') && <p className="text-[11px] text-rose-300">{l.error || l.status.message}</p>}
        {l.mode === 'listen' && l.lastHeard && (
          <p className="line-clamp-2 text-[11px] text-neutral-400" title={l.lastHeard.text}>
            <span className="text-neutral-500">Heard {ago(l.lastHeard.at)} ({(l.lastHeard.ms / 1000).toFixed(1)} s):</span> “{l.lastHeard.text}”
          </p>
        )}
        {l.heardLog.length > 1 && (
          <details className="text-[11px] text-neutral-400">
            <summary className="cursor-pointer text-neutral-500 hover:text-neutral-300">What it heard ({l.heardLog.length})</summary>
            <ol className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
              {l.heardLog.map((h) => (
                <li key={h.at} className="truncate" title={h.text}>
                  <span className="text-neutral-600">{new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> {h.text}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>

      {/* Suggestion cards */}
      {/* Always leave room for at least one card, even on short screens. */}
      <div className="mt-2 min-h-28 flex-1 space-y-1.5 overflow-y-auto px-3">
        {l.suggestions.map((s) => (
          <div
            key={s.key}
            data-suggestion={s.key}
            className={`group rounded-xl border p-2 transition ${s.used ? 'border-white/5 bg-neutral-900/40 opacity-60' : 'border-accent-400/25 bg-accent-500/[0.07]'}`}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {s.item.title}
                  {s.source === 'context' && <span className="rounded bg-neutral-800 px-1 text-[9px] font-medium text-neutral-400">from context</span>}
                  {s.source === 'quote' && (
                    <span className="rounded bg-sky-500/15 px-1 text-[9px] font-medium text-sky-300" title="Recognised from the words, no reference was said">
                      recited
                    </span>
                  )}
                  {s.origin === 'typed' && <span className="rounded bg-neutral-800 px-1 text-[9px] font-medium text-neutral-400">typed</span>}
                </div>
                {s.auto && (
                  <div className={`mt-0.5 text-[10px] font-semibold ${s.auto === 'live' ? 'text-rose-300' : 'text-amber-300'}`}>
                    {s.auto === 'live' ? '● Sent to Preview and Live automatically' : '● Put in Preview automatically'}
                  </div>
                )}
                <div className="line-clamp-2 text-[11px] text-neutral-400">{s.item.slides[0]?.text}</div>
                <div className="mt-0.5 truncate text-[10px] text-neutral-500" title={s.heard}>
                  heard “{s.heard}” · {ago(s.at)}
                </div>
              </div>
              <button onClick={() => l.dismiss(s.key)} title="Dismiss" className="rounded-md p-0.5 text-neutral-500 hover:bg-white/5 hover:text-white">
                <Icon name="x" size={12} />
              </button>
            </div>
            <button
              onClick={() => (onApprove(s.item), l.markUsed(s.key))}
              className="mt-1.5 w-full rounded-lg bg-amber-400/15 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30 transition hover:bg-amber-400/25"
            >
              {s.used ? 'Sent to Preview · send again' : 'Show in Preview'}
            </button>
          </div>
        ))}
        {l.suggestions.length === 0 && (
          <div className="rounded-xl border border-dashed border-accent-400/20 p-3 text-center text-xs text-neutral-400">
            {l.mode === 'listen' ? 'Listening. When the preacher mentions a verse, a card appears here.' : 'Choose the input and press Listen. Cards go to Preview only when you approve them.'}
          </div>
        )}
      </div>

      {/* Test without a preacher */}
      <div className="px-3 pt-1.5">
        {typing ? (
          <div className="space-y-1.5 rounded-xl bg-neutral-950/50 p-2 ring-1 ring-white/5">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => (setText(e.target.value), setTypedResult(''))}
              placeholder='Type what a preacher might say, e.g. "turn with me to Romans chapter eight verse twenty eight"'
              className="field h-14 w-full resize-none text-xs"
            />
            <div className="flex items-center gap-2">
              <button onClick={() => void runTyped()} disabled={!text.trim()} className="btn-accent rounded-lg px-2.5 py-1 text-xs font-semibold">
                Detect
              </button>
              <span className="flex-1 text-[11px] text-neutral-500">{typedResult}</span>
              <button onClick={() => setTyping(false)} className="text-[11px] text-neutral-500 hover:text-neutral-300">
                Close
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setTyping(true)} className="text-[11px] text-accent-300 hover:text-accent-200">
            Test with typed words…
          </button>
        )}
      </div>
    </section>
  )
}

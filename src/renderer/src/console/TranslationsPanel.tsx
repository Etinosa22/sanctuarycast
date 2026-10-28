import { useState } from 'react'
import type { Translations } from './useTranslations'

/** Bottom of the Word tab: tick the translations you want, pick the main one, import licensed copies. */
export function TranslationsPanel({ t }: { t: Translations }) {
  const [importing, setImporting] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [licensed, setLicensed] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (c: string, on: boolean) => void t.update({ main: t.main, enabled: on ? [...t.enabled, c] : t.enabled.filter((x) => x !== c) })
  const makeMain = (c: string) => void t.update({ main: c, enabled: t.enabled.includes(c) ? t.enabled : [...t.enabled, c] })

  const runImport = async () => {
    const r = await window.sc.bible.importTranslation({ code, name, licenceConfirmed: licensed })
    setMessage({ ok: r.ok, text: r.message })
    if (r.ok) {
      t.refresh()
      setImporting(false)
      setCode('')
      setName('')
      setLicensed(false)
    }
  }

  const remove = async (c: string, n: string) => {
    if (!window.confirm(`Remove ${n} (${c}) from this computer? You can import it again later.`)) return
    await window.sc.bible.removeTranslation(c)
    t.refresh()
  }

  return (
    <div className="shrink-0 border-t border-white/5 bg-neutral-950/50 px-2 pt-2 pb-3">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h3 className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">Translations</h3>
        <button onClick={() => (setImporting((v) => !v), setMessage(null))} className="rounded px-1.5 text-xs text-accent-300 hover:bg-neutral-800">
          + Import licensed
        </button>
      </div>

      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {t.list.map((tr) => {
          const isMain = tr.code === t.main
          return (
            <li key={tr.code} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-900">
              <input
                type="checkbox"
                checked={tr.enabled}
                disabled={isMain}
                onChange={(e) => toggle(tr.code, e.target.checked)}
                title={isMain ? 'The main translation is always available' : 'Offer as a quick switch'}
                className="accent-accent-500"
              />
              <span className="w-12 shrink-0 text-xs font-semibold">{tr.code}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-neutral-400" title={tr.name}>
                {tr.name}
              </span>
              {isMain ? (
                <span className="rounded-md bg-gradient-to-r from-accent-500 to-accent-700 px-1.5 text-[10px] font-semibold tracking-wide text-white">MAIN</span>
              ) : (
                <button onClick={() => makeMain(tr.code)} className="hidden rounded px-1.5 text-[10px] text-neutral-300 group-hover:block hover:bg-neutral-700">
                  Make main
                </button>
              )}
              {!tr.bundled && !isMain && (
                <button onClick={() => void remove(tr.code, tr.name)} title="Remove imported translation" className="hidden rounded px-1 text-neutral-500 group-hover:block hover:bg-red-800 hover:text-white">
                  ×
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {importing && (
        <div className="card mt-2 space-y-2 p-2 text-xs">
          <p className="text-neutral-400">
            For NIV, NLT, NKJV, AMP, TPT and other copyrighted versions. Use a file the church is licensed to project: CSV with columns
            Book, Chapter, Verse, Text.
          </p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (NIV)" className="field w-20 text-xs" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="field min-w-0 flex-1 text-xs" />
          </div>
          <label className="flex items-start gap-2 text-neutral-300">
            <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)} className="mt-0.5 accent-accent-500" />
            The church holds a licence from the publisher to project this translation.
          </label>
          <button
            onClick={() => void runImport()}
            disabled={!licensed || !code || !name}
            className="btn-accent w-full rounded-lg py-1.5 font-semibold"
          >
            Choose file and import
          </button>
        </div>
      )}
      {message && <p className={`mt-1 px-1 text-xs ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
    </div>
  )
}

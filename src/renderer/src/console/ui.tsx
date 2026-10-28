// Small shared pieces for the operator console.

import type { ReactNode } from 'react'
import type { EngineAction, ServiceAction, SlideKind } from '../../../shared/types'
import { Icon, type IconName } from './icons'

export const send = (a: EngineAction) => void window.sc.dispatch(a)
export const sendService = (a: ServiceAction) => void window.sc.dispatchService(a)

export const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export const KIND_STYLE: Record<SlideKind, { tag: string; className: string; icon: IconName }> = {
  song: { tag: 'Song', className: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20', icon: 'music' },
  scripture: { tag: 'Bible', className: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20', icon: 'book' },
  announcement: { tag: 'Notice', className: 'bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-400/20', icon: 'sparkles' }
}

export function KindTag({ kind }: { kind: SlideKind }) {
  const k = KIND_STYLE[kind]
  return <span className={`inline-flex items-center rounded-md px-1.5 py-px text-[10px] font-medium tracking-wide ${k.className}`}>{k.tag}</span>
}

export function PanelTitle({ children, right, icon }: { children: ReactNode; right?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-neutral-400 uppercase">
        {icon && <Icon name={icon} size={13} className="text-accent-400" />}
        {children}
      </h2>
      {right}
    </div>
  )
}

/** Small text button for panel headers ("+ New song"). */
export function LinkButton({ onClick, children, title, icon = 'plus' }: { onClick: () => void; children: ReactNode; title?: string; icon?: IconName }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent-300 transition-colors hover:bg-accent-500/15 hover:text-accent-200"
    >
      <Icon name={icon} size={12} />
      {children}
    </button>
  )
}

export function ControlButton(props: {
  onClick: () => void
  children: ReactNode
  active?: boolean
  tone?: 'go' | 'danger' | 'plain'
  hint?: string
  icon?: IconName
  className?: string
}) {
  const tone = props.active
    ? 'bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-[0_0_18px_-2px_rgb(244_63_94/0.65)] ring-1 ring-rose-300/60'
    : props.tone === 'go'
      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_6px_18px_-6px_rgb(16_185_129/0.7)] hover:brightness-110'
      : props.tone === 'danger'
        ? 'bg-neutral-800/70 text-neutral-300 ring-1 ring-white/5 hover:bg-rose-900/60 hover:text-white'
        : 'bg-neutral-800/80 text-neutral-100 ring-1 ring-white/5 hover:bg-neutral-700/80'
  return (
    <button
      onClick={props.onClick}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${tone} ${props.className ?? ''}`}
    >
      <span className="flex items-center gap-2">
        {props.icon && <Icon name={props.icon} size={15} className="opacity-80" />}
        {props.children}
      </span>
      {props.hint && <kbd className="rounded-md bg-black/25 px-1.5 py-px font-sans text-[10px] font-semibold tracking-wide">{props.hint}</kbd>}
    </button>
  )
}

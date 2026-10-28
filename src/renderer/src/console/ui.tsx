// Small shared pieces for the operator console.

import type { ReactNode } from 'react'
import type { EngineAction, ServiceAction, SlideKind } from '../../../shared/types'

export const send = (a: EngineAction) => void window.sc.dispatch(a)
export const sendService = (a: ServiceAction) => void window.sc.dispatchService(a)

export const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export const KIND_STYLE: Record<SlideKind, { tag: string; className: string }> = {
  song: { tag: 'Song', className: 'bg-sky-900/70 text-sky-200' },
  scripture: { tag: 'Bible', className: 'bg-amber-900/70 text-amber-200' },
  announcement: { tag: 'Notice', className: 'bg-violet-900/70 text-violet-200' }
}

export function PanelTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2">
      <h2 className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">{children}</h2>
      {right}
    </div>
  )
}

export function ControlButton(props: {
  onClick: () => void
  children: ReactNode
  active?: boolean
  tone?: 'go' | 'danger' | 'plain'
  hint?: string
  className?: string
}) {
  const tone = props.active
    ? 'bg-red-600 text-white ring-2 ring-red-300'
    : props.tone === 'go'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
      : props.tone === 'danger'
        ? 'bg-neutral-800 hover:bg-red-800 text-neutral-200'
        : 'bg-neutral-700 hover:bg-neutral-600 text-white'
  return (
    <button
      onClick={props.onClick}
      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${tone} ${props.className ?? ''}`}
    >
      <span>{props.children}</span>
      {props.hint && <kbd className="rounded bg-black/30 px-1.5 text-[11px]">{props.hint}</kbd>}
    </button>
  )
}

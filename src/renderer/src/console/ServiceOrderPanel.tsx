import { useState } from 'react'
import type { ServiceItem, ServiceState } from '../../../shared/types'
import { Icon } from './icons'
import { KindTag, LinkButton, PanelTitle, sendService } from './ui'

/** Splits pasted announcement text into slides at blank lines. */
function announcementItem(text: string): ServiceItem | null {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const id = `notice-${Date.now()}`
  return {
    id,
    kind: 'announcement',
    title: parts[0].split('\n')[0].slice(0, 40),
    slides: parts.map((t, n) => ({ id: `${id}-${n + 1}`, kind: 'announcement', section: String(n + 1), text: t }))
  }
}

function AddNotice({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('')
  const add = () => {
    const item = announcementItem(text)
    if (item) sendService({ type: 'addItem', item })
    onDone()
  }
  return (
    <div className="card mx-2 mb-2 space-y-2 p-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        placeholder={'Announcement text.\nLeave a blank line to start a new slide.'}
        className="field h-24 w-full resize-none"
      />
      <div className="flex justify-end gap-2 text-sm">
        <button onClick={onDone} className="rounded px-2 py-1 text-neutral-400 hover:text-white">
          Cancel
        </button>
        <button onClick={add} className="btn-accent rounded-lg px-3 py-1 font-medium">
          Add to service
        </button>
      </div>
    </div>
  )
}

export function ServiceOrderPanel(props: {
  service: ServiceState
  selectedId: string | null
  onSelect: (id: string) => void
  previewSlideId?: string
  liveSlideId?: string
}) {
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const drop = (index: number) => {
    if (!dragId) return
    const from = props.service.items.findIndex((i) => i.id === dragId)
    // Dropping below the dragged item shifts every later index up by one.
    sendService({ type: 'moveItem', itemId: dragId, toIndex: index > from ? index - 1 : index })
    setDragId(null)
    setDropIndex(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelTitle
        icon="list"
        right={
          <LinkButton onClick={() => setAdding(true)} title="Add an announcement">
            Notice
          </LinkButton>
        }
      >
        Service order
      </PanelTitle>
      {adding && <AddNotice onDone={() => setAdding(false)} />}

      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2" onDragLeave={() => setDropIndex(null)}>
        {props.service.items.map((item, index) => {
          const selected = item.id === props.selectedId
          const isLive = item.slides.some((s) => s.id === props.liveSlideId)
          const isPreview = item.slides.some((s) => s.id === props.previewSlideId)
          return (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragEnd={() => (setDragId(null), setDropIndex(null))}
              onDragOver={(e) => {
                e.preventDefault()
                const r = e.currentTarget.getBoundingClientRect()
                setDropIndex(e.clientY > r.top + r.height / 2 ? index + 1 : index)
              }}
              onDrop={(e) => (e.preventDefault(), drop(dropIndex ?? index))}
              className={`group relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
                selected
                  ? 'border-accent-400/40 bg-accent-500/12 shadow-[inset_3px_0_0_var(--color-accent-400)]'
                  : 'border-transparent hover:bg-white/[0.04]'
              } ${dragId === item.id ? 'opacity-40' : ''}`}
              onClick={() => props.onSelect(item.id)}
            >
              {dropIndex === index && dragId && <div className="absolute -top-1 right-1 left-1 h-0.5 rounded bg-accent-400" />}
              {dropIndex === index + 1 && dragId && index === props.service.items.length - 1 && (
                <div className="absolute right-1 -bottom-1 left-1 h-0.5 rounded bg-accent-400" />
              )}
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ${
                  selected ? 'bg-accent-500/30 text-accent-100' : 'bg-neutral-800/80 text-neutral-400'
                }`}
                title={index < 9 ? `Key ${index + 1}` : undefined}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <KindTag kind={item.kind} />
                  {item.slides.length} slide{item.slides.length === 1 ? '' : 's'}
                </div>
              </div>
              {isLive && <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-rose-500" title="On Live" />}
              {isPreview && !isLive && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="In Preview" />}
              <button
                onClick={(e) => (e.stopPropagation(), sendService({ type: 'removeItem', itemId: item.id }))}
                className="hidden shrink-0 rounded-md p-1 text-neutral-500 group-hover:block hover:bg-rose-900/70 hover:text-white"
                title="Remove from service (what is on screen stays)"
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          )
        })}
        {props.service.items.length === 0 && <li className="p-3 text-sm text-neutral-500">No items yet. Add songs from the Songs tab, readings from the Word tab, or a notice.</li>}
      </ol>
    </div>
  )
}

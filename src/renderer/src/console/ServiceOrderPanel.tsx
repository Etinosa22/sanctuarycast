import { useState } from 'react'
import type { ServiceItem, ServiceState } from '../../../shared/types'
import { KIND_STYLE, PanelTitle, sendService } from './ui'

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
    <div className="mx-2 mb-2 space-y-2 rounded-md border border-neutral-700 bg-neutral-900 p-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        placeholder={'Announcement text.\nLeave a blank line to start a new slide.'}
        className="h-24 w-full resize-none rounded bg-neutral-800 p-2 text-sm outline-none focus:ring-1 focus:ring-amber-400"
      />
      <div className="flex justify-end gap-2 text-sm">
        <button onClick={onDone} className="rounded px-2 py-1 text-neutral-400 hover:text-white">
          Cancel
        </button>
        <button onClick={add} className="rounded bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-500">
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
        right={
          <button onClick={() => setAdding(true)} className="rounded px-1.5 text-xs text-amber-300 hover:bg-neutral-800" title="Add an announcement">
            + Notice
          </button>
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
          const kind = KIND_STYLE[item.kind]
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
              className={`group relative flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 ${
                selected ? 'border-amber-400/70 bg-neutral-800' : 'border-transparent hover:bg-neutral-900'
              } ${dragId === item.id ? 'opacity-40' : ''}`}
              onClick={() => props.onSelect(item.id)}
            >
              {dropIndex === index && dragId && <div className="absolute -top-1 right-1 left-1 h-0.5 rounded bg-amber-400" />}
              {dropIndex === index + 1 && dragId && index === props.service.items.length - 1 && (
                <div className="absolute right-1 -bottom-1 left-1 h-0.5 rounded bg-amber-400" />
              )}
              <span className="w-4 shrink-0 text-center text-xs text-neutral-500 tabular-nums" title={index < 9 ? `Key ${index + 1}` : undefined}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{item.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className={`rounded px-1 ${kind.className}`}>{kind.tag}</span>
                  {item.slides.length} slide{item.slides.length === 1 ? '' : 's'}
                </div>
              </div>
              {isLive && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="On Live" />}
              {isPreview && !isLive && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="In Preview" />}
              <button
                onClick={(e) => (e.stopPropagation(), sendService({ type: 'removeItem', itemId: item.id }))}
                className="hidden shrink-0 rounded px-1 text-neutral-500 group-hover:block hover:bg-red-900 hover:text-white"
                title="Remove from service (what is on screen stays)"
              >
                ×
              </button>
            </li>
          )
        })}
        {props.service.items.length === 0 && <li className="p-3 text-sm text-neutral-500">No items yet. Add songs from the Songs tab, readings from the Word tab, or a notice.</li>}
      </ol>
    </div>
  )
}

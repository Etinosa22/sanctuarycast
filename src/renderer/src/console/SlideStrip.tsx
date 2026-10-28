import type { PresentationState, ServiceItem } from '../../../shared/types'
import { SlideCanvas } from '../components/SlideCanvas'
import { KIND_STYLE, send } from './ui'

/** Thumbnails of the open item's slides. Click puts a slide in Preview. */
export function SlideStrip(props: {
  item: ServiceItem | undefined
  state: PresentationState
  /** Set when the item came from the library rather than the service order. */
  onAddToService?: () => void
  onEditSong?: () => void
  /** Translations offered as one-click switches for scripture. */
  translations?: string[]
  onSwitchTranslation?: (code: string) => void
}) {
  const { item, state } = props
  if (!item) return <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">Pick a service item, song or passage</div>

  const kind = KIND_STYLE[item.kind]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 pb-2 text-sm">
        <span className={`rounded px-1 text-[11px] ${kind.className}`}>{kind.tag}</span>
        <span className="font-medium">{item.title}</span>
        <span className="text-xs text-neutral-500">click a slide to put it in Preview</span>
        <span className="flex-1" />
        {item.scripture && props.onSwitchTranslation && (props.translations?.length ?? 0) > 1 && (
          <div className="flex overflow-hidden rounded ring-1 ring-neutral-700" title="Switch translation">
            {props.translations!.map((code) => (
              <button
                key={code}
                onClick={() => code !== item.scripture!.translation && props.onSwitchTranslation!(code)}
                className={`px-2 py-0.5 text-xs font-medium ${
                  code === item.scripture!.translation ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        )}
        {props.onEditSong && (
          <button onClick={props.onEditSong} className="rounded px-2 py-0.5 text-xs text-neutral-300 hover:bg-neutral-800">
            Edit song
          </button>
        )}
        {props.onAddToService && (
          <button onClick={props.onAddToService} className="rounded bg-neutral-700 px-2 py-0.5 text-xs font-medium hover:bg-neutral-600">
            + Add to service
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 overflow-y-auto pr-1">
        {item.slides.map((slide) => {
          const live = state.live?.slide.id === slide.id
          const preview = state.preview?.slide.id === slide.id
          return (
            <button
              key={slide.id}
              onClick={() => send({ type: 'stage', slide })}
              className={`group overflow-hidden rounded-md text-left ring-2 ${
                live ? 'ring-red-500' : preview ? 'ring-amber-400' : 'ring-neutral-800 hover:ring-neutral-500'
              }`}
            >
              <div className="pointer-events-none aspect-video">
                <SlideCanvas frame={{ slide, background: state.background, theme: state.theme }} />
              </div>
              <div className="flex items-center justify-between bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300">
                <span>{slide.section ?? ''}</span>
                {live ? <span className="font-bold text-red-400">LIVE</span> : preview ? <span className="text-amber-300">PREVIEW</span> : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

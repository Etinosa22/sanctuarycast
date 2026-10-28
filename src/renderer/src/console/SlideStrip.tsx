import type { PresentationState, ServiceItem } from '../../../shared/types'
import { SlideCanvas } from '../components/SlideCanvas'
import { Icon } from './icons'
import { KindTag, send } from './ui'

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
  if (!item) {
    return (
      <div className="card flex flex-1 flex-col items-center justify-center gap-2 text-sm text-neutral-500">
        <Icon name="layers" size={28} className="text-neutral-600" />
        Pick a service item, song or passage
      </div>
    )
  }

  return (
    <div className="card flex min-h-0 flex-1 flex-col p-3">
      <div className="flex items-center gap-2 pb-3 text-sm">
        <KindTag kind={item.kind} />
        <span className="font-semibold tracking-tight">{item.title}</span>
        <span className="text-xs text-neutral-500">click a slide to put it in Preview</span>
        <span className="flex-1" />
        {item.scripture && props.onSwitchTranslation && (props.translations?.length ?? 0) > 1 && (
          <div className="flex gap-0.5 rounded-lg bg-neutral-950/70 p-0.5 ring-1 ring-white/5" title="Switch translation">
            {props.translations!.map((code) => (
              <button
                key={code}
                onClick={() => code !== item.scripture!.translation && props.onSwitchTranslation!(code)}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                  code === item.scripture!.translation ? 'bg-accent-600 text-white shadow-sm' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        )}
        {props.onEditSong && (
          <button onClick={props.onEditSong} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-300 transition hover:bg-white/5">
            <Icon name="edit" size={12} />
            Edit song
          </button>
        )}
        {props.onAddToService && (
          <button onClick={props.onAddToService} className="btn-accent inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold">
            <Icon name="plus" size={12} />
            Add to service
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 overflow-y-auto p-0.5 pr-1">
        {item.slides.map((slide) => {
          const live = state.live?.slide.id === slide.id
          const preview = state.preview?.slide.id === slide.id
          return (
            <button
              key={slide.id}
              onClick={() => send({ type: 'stage', slide })}
              className={`group overflow-hidden rounded-xl bg-neutral-950 text-left ring-2 transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgb(0_0_0/0.8)] ${
                live ? 'ring-rose-500' : preview ? 'ring-amber-400' : 'ring-white/5 hover:ring-accent-400/50'
              }`}
            >
              <div className="pointer-events-none aspect-video">
                <SlideCanvas frame={{ slide, background: state.background, theme: state.theme }} />
              </div>
              <div className="flex items-center justify-between bg-neutral-900/90 px-2.5 py-1.5 text-[11px] text-neutral-300">
                <span className="font-medium">{slide.section ?? ''}</span>
                {live ? (
                  <span className="rounded bg-rose-500/20 px-1.5 font-bold tracking-wider text-rose-300">LIVE</span>
                ) : preview ? (
                  <span className="rounded bg-amber-400/15 px-1.5 font-semibold tracking-wider text-amber-300">PREVIEW</span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

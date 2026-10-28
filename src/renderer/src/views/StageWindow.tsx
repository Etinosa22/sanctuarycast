import type { StageView } from '../../../shared/types'
import { formatElapsed, useEngineState, useNow } from '../useEngineState'

/** Stage Display for the pulpit and band: current slide, next slide, clock. */
export function StageWindow() {
  const view = useEngineState<StageView>()
  const now = useNow()
  const status = view?.blanked ? 'SCREEN BLANK' : view?.logo ? 'LOGO SCREEN' : view?.clearText ? 'TEXT CLEARED' : null

  return (
    <div className="flex h-screen w-screen flex-col bg-black p-[3vh] text-white">
      <div className="flex items-baseline justify-between text-[4vh] text-neutral-400">
        <span className="tabular-nums text-white">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        {status && <span className="rounded bg-red-700 px-[1.5vh] text-[3vh] font-bold text-white">{status}</span>}
        <span className="tabular-nums">{view?.liveSince ? `on screen ${formatElapsed(now - view.liveSince)}` : ''}</span>
      </div>
      <div className="flex flex-[3] items-center justify-center whitespace-pre-line text-center text-[6vh] leading-tight font-semibold">
        {view?.live?.slide.text ?? ''}
      </div>
      <div className="flex-1 border-t border-neutral-700 pt-[2vh]">
        <div className="text-[2.5vh] uppercase tracking-widest text-neutral-500">Next</div>
        <div className="line-clamp-3 whitespace-pre-line text-[3.5vh] text-amber-200">{view?.next?.slide.text ?? '—'}</div>
      </div>
    </div>
  )
}

import type { OutputView } from '../../../shared/types'
import { SlideCanvas } from '../components/SlideCanvas'
import { useEngineState } from '../useEngineState'

/** Main Output (projector): Live and nothing else. */
export function OutputWindow() {
  const view = useEngineState<OutputView>()
  return (
    <div className="h-screen w-screen">
      <SlideCanvas frame={view?.live ?? null} masks={view ?? undefined} animate />
    </div>
  )
}

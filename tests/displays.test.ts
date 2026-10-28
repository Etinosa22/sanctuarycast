import { describe, expect, it } from 'vitest'
import { manualStagePlacement, planOutputs, type DisplayInfo } from '../src/main/displays'

const display = (id: number, x: number): DisplayInfo => {
  const r = { x, y: 0, width: 1920, height: 1080 }
  return { id, bounds: r, workArea: r }
}
const laptop = display(1, 0)
const projector = display(2, 1920)
const tv = display(3, 3840)

describe('planOutputs', () => {
  it('one display: outputs open as normal test windows', () => {
    const p = planOutputs([laptop], 1)
    expect(p.console).toBe(laptop)
    expect(p.main).toEqual({ display: laptop, fullscreen: false })
    expect(p.stage).toEqual({ display: laptop, fullscreen: false })
  })

  it('two displays: Main Output full screen on the second, stage on request', () => {
    const p = planOutputs([laptop, projector], 1)
    expect(p.main).toEqual({ display: projector, fullscreen: true })
    expect(p.stage).toBeNull()
    expect(manualStagePlacement(p)).toEqual({ display: laptop, fullscreen: false })
  })

  it('three displays: stage display full screen on the third', () => {
    const p = planOutputs([tv, laptop, projector], 1)
    expect(p.main.display).toBe(projector)
    expect(p.stage).toEqual({ display: tv, fullscreen: true })
  })

  it('never puts the projector output on the operator screen when a second exists', () => {
    const p = planOutputs([projector, laptop], 1)
    expect(p.console).toBe(laptop)
    expect(p.main.display).toBe(projector)
  })

  it('falls back to the first display if the primary id is unknown', () => {
    expect(planOutputs([laptop], 99).console).toBe(laptop)
  })

  it('throws with no displays', () => {
    expect(() => planOutputs([], 1)).toThrow()
  })
})

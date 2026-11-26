import { describe, expect, it } from 'vitest'
import { diffInputs, displayName, findSaved, pickChannel } from '../src/shared/audioInputs'

const laptop = { deviceId: 'a1', label: 'Microphone Array (Realtek(R) Audio)' }
const headset = { deviceId: 'b2', label: 'Headset (oraimo BoomPop Lite) (Bluetooth)' }
const behringer = { deviceId: 'c3', label: 'Line (UMC202HD 192k)' }
const winDefault = { deviceId: 'default', label: 'Default - Microphone Array (Realtek(R) Audio)' }

describe('noticing inputs being plugged in and out', () => {
  it('reports a newly connected interface', () => {
    expect(diffInputs([winDefault, laptop, headset], [winDefault, laptop, headset, behringer])).toEqual({ added: [behringer], removed: [] })
  })

  it('reports one being unplugged', () => {
    expect(diffInputs([laptop, behringer], [laptop])).toEqual({ added: [], removed: [behringer] })
  })

  it('ignores Windows changing which device is "default"', () => {
    const newDefault = { deviceId: 'default', label: 'Default - Line (UMC202HD 192k)' }
    expect(diffInputs([winDefault, laptop, behringer], [newDefault, laptop, behringer])).toEqual({ added: [], removed: [] })
  })

  it('shows friendly names', () => {
    expect(displayName(winDefault.label)).toBe('Microphone Array (Realtek(R) Audio)')
    expect(displayName('Communications - Headset')).toBe('Headset')
    expect(displayName('')).toBe('Unnamed input')
  })
})

describe('finding the chosen input again', () => {
  it('by its id', () => {
    expect(findSaved({ deviceId: 'c3', label: behringer.label }, [laptop, behringer])).toBe('c3')
  })

  it('by its name when Windows gave it a new id (another USB port)', () => {
    const moved = { deviceId: 'z9', label: 'Line (UMC202HD 192k)' }
    expect(findSaved({ deviceId: 'c3', label: behringer.label }, [laptop, moved])).toBe('z9')
  })

  it("'' when it isn't connected, or when the default input was chosen", () => {
    expect(findSaved({ deviceId: 'c3', label: behringer.label }, [laptop])).toBe('')
    expect(findSaved({ deviceId: '', label: '' }, [laptop])).toBe('')
  })
})

describe('choosing a channel on a two-input interface', () => {
  const left = new Float32Array([0.5, 0.5])
  const right = new Float32Array([0, 0])

  it('mix averages the inputs', () => {
    expect([...pickChannel([left, right], 'mix')]).toEqual([0.25, 0.25])
  })

  it('left or right takes one input at full level', () => {
    expect(pickChannel([left, right], 'left')).toBe(left)
    expect(pickChannel([left, right], 'right')).toBe(right)
  })

  it('a mono microphone is used as it is, whatever the choice', () => {
    expect(pickChannel([left], 'right')).toBe(left)
    expect(pickChannel([], 'mix')).toEqual(new Float32Array(0))
  })
})

// Audio input bookkeeping for the detector: which inputs appeared or vanished,
// finding the chosen input again after a replug, and picking a channel from a
// two-input interface. Pure, so it is tested without real hardware.

export interface InputInfo {
  deviceId: string
  label: string
}

/** Windows lists "default" and "communications" as extra entries pointing at real devices. */
export const isAlias = (d: InputInfo) => d.deviceId === 'default' || d.deviceId === 'communications'

/** "Default - Microphone (Realtek)" -> "Microphone (Realtek)". */
export const displayName = (label: string) => label.replace(/^(Default|Communications) - /, '') || 'Unnamed input'

/** Real inputs that appeared or disappeared between two scans. */
export function diffInputs<T extends InputInfo>(before: T[], after: T[]): { added: T[]; removed: T[] } {
  const ids = (list: T[]) => new Set(list.filter((d) => !isAlias(d)).map((d) => d.deviceId))
  const was = ids(before)
  const now = ids(after)
  return {
    added: after.filter((d) => !isAlias(d) && !was.has(d.deviceId)),
    removed: before.filter((d) => !isAlias(d) && !now.has(d.deviceId))
  }
}

export interface SavedInput {
  /** '' means Windows' default input. */
  deviceId: string
  label: string
}

/**
 * Finds the saved input in the current list: by id, or by name if Windows gave
 * it a new id (e.g. plugged into another USB port). '' if it isn't connected.
 */
export function findSaved(saved: SavedInput, inputs: InputInfo[]): string {
  if (!saved.deviceId) return ''
  if (inputs.some((d) => d.deviceId === saved.deviceId)) return saved.deviceId
  const byName = saved.label && inputs.find((d) => !isAlias(d) && displayName(d.label) === displayName(saved.label))
  return byName ? byName.deviceId : ''
}

export type InputChannel = 'mix' | 'left' | 'right'

/**
 * One channel of audio from what the input delivered. 'mix' averages all
 * channels; on a two-input interface with only input 2 in use, 'right' avoids
 * halving the level by mixing in silence.
 */
export function pickChannel(channels: Float32Array[], choice: InputChannel): Float32Array {
  if (channels.length === 0) return new Float32Array(0)
  if (channels.length === 1) return channels[0]
  if (choice === 'left') return channels[0]
  if (choice === 'right') return channels[1]
  const out = new Float32Array(channels[0].length)
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length
  return out
}

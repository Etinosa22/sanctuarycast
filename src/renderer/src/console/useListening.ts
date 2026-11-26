// Microphone / mixer input for scripture detection. Opens the chosen input only
// while testing or listening, shows a level, and sends 16 kHz mono chunks to
// the speech engine in main. Watches for inputs being plugged in or out (e.g.
// a USB audio interface) and follows the operator's choice back when it returns.
// Suggestions come back here; what reaches Live depends on the detection mode.

import { useCallback, useEffect, useRef, useState } from 'react'
import { diffInputs, findSaved, isAlias, pickChannel, type InputChannel, type SavedInput } from '../../../shared/audioInputs'
import type { AiMode, AiStatus, AiSuggestion } from '../../../shared/types'

const TARGET_RATE = 16_000
/** Send every 2 s the last 5 s of audio: overlap means no reference is cut in half. */
const STEP_MS = 2000
const WINDOW_SECONDS = 5
/** Below this RMS the chunk is treated as silence and not transcribed. */
const SILENCE_RMS = 0.006
const STORE_KEY = 'sc.audioInput.v2'

export type MicMode = 'off' | 'test' | 'listen'

interface Stored extends SavedInput {
  channel: InputChannel
}

export interface Listening {
  devices: MediaDeviceInfo[]
  /** '' means Windows' default input. */
  deviceId: string
  setDeviceId: (id: string) => void
  channel: InputChannel
  setChannel: (c: InputChannel) => void
  /** Channels the open input delivers (2 for most audio interfaces); 0 when closed. */
  inputChannels: number
  /** Look for inputs again (also happens by itself when Windows reports a change). */
  rescan: () => Promise<void>
  /** An input that was just plugged in, offered to the operator. */
  newInput: MediaDeviceInfo | null
  dismissNewInput: () => void
  /** Plain-language note about inputs changing ("… was unplugged"). */
  notice: string
  mode: MicMode
  /** 0..1 input level, for the meter. */
  level: number
  status: AiStatus
  lastHeard: { text: string; ms: number; at: number } | null
  /** The last few things the engine heard, newest first, to see where it goes wrong. */
  heardLog: { text: string; ms: number; at: number }[]
  suggestions: (AiSuggestion & { used?: boolean })[]
  error: string
  test: () => Promise<void>
  listen: () => Promise<void>
  stop: () => void
  dismiss: (key: string) => void
  markUsed: (key: string) => void
  clear: () => void
  testText: (text: string) => Promise<number>
  /** What the detector may do by itself: cards only, Preview, or Preview and Live. */
  aiMode: AiMode
  setAiMode: (mode: AiMode) => Promise<void>
}

const readStored = (): Stored => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Stored> | null
    // Earlier builds stored only the id.
    const legacy = localStorage.getItem('sc.audioInput') ?? ''
    return { deviceId: raw?.deviceId ?? legacy, label: raw?.label ?? '', channel: raw?.channel ?? 'mix' }
  } catch {
    return { deviceId: '', label: '', channel: 'mix' }
  }
}

const writeStored = (s: Stored) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* per-viewer convenience only */
  }
}

/** onAuto runs when the detector put a passage in Preview (or Live) by itself, so the console can show it. */
export function useListening(onAuto?: (s: AiSuggestion) => void): Listening {
  const onAutoRef = useRef(onAuto)
  onAutoRef.current = onAuto
  const [aiMode, setAiModeState] = useState<AiMode>('preview')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  /** What the operator chose; kept even while that input is unplugged. */
  const [chosen, setChosen] = useState<Stored>(readStored)
  /** The input actually in use: the chosen one, or the default while it is missing. */
  const [deviceId, setDeviceIdState] = useState(chosen.deviceId)
  const [inputChannels, setInputChannels] = useState(0)
  const [newInput, setNewInput] = useState<MediaDeviceInfo | null>(null)
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState<MicMode>('off')
  const [level, setLevel] = useState(0)
  const [status, setStatus] = useState<AiStatus>({ state: 'stopped', message: '' })
  const [lastHeard, setLastHeard] = useState<Listening['lastHeard']>(null)
  const [heardLog, setHeardLog] = useState<Listening['heardLog']>([])
  const [suggestions, setSuggestions] = useState<Listening['suggestions']>([])
  const [error, setError] = useState('')

  const audio = useRef<{ stream: MediaStream; ctx: AudioContext; timer: number; raf: number } | null>(null)
  const ring = useRef(new Float32Array(TARGET_RATE * WINDOW_SECONDS))
  const filled = useRef(0)
  /** Next write position in the circular buffer. */
  const head = useRef(0)
  const modeRef = useRef<MicMode>('off')
  const levelRef = useRef(0)
  const channelRef = useRef<InputChannel>(chosen.channel)
  channelRef.current = chosen.channel
  const lastScan = useRef<MediaDeviceInfo[] | null>(null)
  const chosenRef = useRef(chosen)
  chosenRef.current = chosen
  const deviceIdRef = useRef(deviceId)
  deviceIdRef.current = deviceId

  const close = useCallback(() => {
    const a = audio.current
    if (!a) return
    clearInterval(a.timer)
    cancelAnimationFrame(a.raf)
    a.stream.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
    void a.ctx.close()
    audio.current = null
    filled.current = 0
    head.current = 0
    levelRef.current = 0
    setLevel(0)
    setInputChannels(0)
  }, [])

  /** Reacts to inputs appearing or disappearing; called on Windows' devicechange and on rescan. */
  const scan = useCallback(async () => {
    const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
    setDevices(inputs)
    const before = lastScan.current
    lastScan.current = inputs
    if (!before) {
      // First scan: use the saved input if it's here (perhaps under a new id), else the default.
      const found = findSaved(chosenRef.current, inputs)
      setDeviceIdState(found)
      if (chosenRef.current.deviceId && !found) setNotice(`${chosenRef.current.label || 'The chosen input'} isn't connected; using the default input.`)
      return
    }
    const { added, removed } = diffInputs(before, inputs)
    const back = findSaved(chosenRef.current, inputs)
    if (chosenRef.current.deviceId && back && added.some((d) => d.deviceId === back)) {
      // The operator's chosen input came back: switch to it again.
      setDeviceIdState(back)
      setNotice(`${chosenRef.current.label} is connected again and in use.`)
      return
    }
    if (removed.some((d) => d.deviceId === deviceIdRef.current)) {
      setDeviceIdState('')
      setNotice(`${removed.find((d) => d.deviceId === deviceIdRef.current)?.label || 'The input'} was unplugged; using the default input until it's back.`)
    }
    const fresh = added.find((d) => !isAlias(d))
    if (fresh) setNewInput(fresh)
  }, [])

  useEffect(() => {
    void scan()
    navigator.mediaDevices.addEventListener('devicechange', scan)
    void window.sc.ai.status().then(setStatus)
    void window.sc.ai.getMode().then(setAiModeState)
    const off = window.sc.ai.onEvent((e) => {
      if (e.type === 'status') setStatus(e.status)
      else if (e.type === 'transcript') {
        const h = { text: e.text, ms: e.ms, at: Date.now() }
        setLastHeard(h)
        setHeardLog((log) => [h, ...log].slice(0, 12))
      } else {
        setSuggestions((list) => [e.suggestion, ...list.filter((s) => s.key !== e.suggestion.key && s.key !== e.suggestion.replaces)].slice(0, 25))
        if (e.suggestion.auto) onAutoRef.current?.(e.suggestion)
      }
    })
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', scan)
      off()
    }
  }, [scan])

  const open = useCallback(
    async (next: MicMode) => {
      close()
      setError('')
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            // No channelCount: an audio interface delivers both inputs and the operator picks one.
            // A mixer feed is already clean; echo cancellation would eat the preacher.
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
      } catch (err) {
        setError(err instanceof Error && err.name === 'NotAllowedError' ? 'Microphone access was refused' : 'Could not open that audio input')
        setMode('off')
        modeRef.current = 'off'
        return
      }
      // Labels only appear once access is granted.
      void scan()
      const track = stream.getAudioTracks()[0]
      // Unplugged mid-service: the track ends. Fall back rather than going silent.
      if (track) track.onended = () => void scan()

      // Run the audio graph at 16 kHz so Chromium's own high-quality resampler does
      // the conversion; fall back to the device rate (and our averaging) if refused.
      let ctx: AudioContext
      try {
        ctx = new AudioContext({ sampleRate: TARGET_RATE })
      } catch {
        ctx = new AudioContext()
      }
      const source = ctx.createMediaStreamSource(stream)
      // What the device really delivers (2 on most audio interfaces). The source node's own
      // channelCount is a Web Audio default of 2 for every input, so it can't be used here.
      const channels = Math.min(2, Math.max(1, track?.getSettings().channelCount ?? 1))
      setInputChannels(channels)

      // Collect the chosen channel, downsampled to 16 kHz by averaging, into a circular buffer.
      const ratio = ctx.sampleRate / TARGET_RATE
      const proc = ctx.createScriptProcessor(4096, channels, 1)
      let carry = 0
      proc.onaudioprocess = (ev) => {
        const all: Float32Array[] = []
        for (let c = 0; c < ev.inputBuffer.numberOfChannels; c++) all.push(ev.inputBuffer.getChannelData(c))
        const input = pickChannel(all, channelRef.current)
        let sq = 0
        for (const v of input) sq += v * v
        // The meter shows the channel actually being listened to.
        levelRef.current = Math.min(1, Math.sqrt(sq / Math.max(1, input.length)) * 4)
        const buf = ring.current
        for (let pos = carry; pos < input.length; pos += ratio) {
          const from = Math.floor(pos)
          const to = Math.min(input.length, Math.floor(pos + ratio))
          let sum = 0
          for (let k = from; k < to; k++) sum += input[k]
          buf[head.current] = to > from ? sum / (to - from) : input[from]
          head.current = (head.current + 1) % buf.length
          if (filled.current < buf.length) filled.current++
          carry = pos + ratio - input.length
        }
      }
      source.connect(proc)
      // The processor only runs when connected to an output; a muted gain keeps the speakers silent.
      const mute = ctx.createGain()
      mute.gain.value = 0
      proc.connect(mute).connect(ctx.destination)

      let frame = 0
      const meter = () => {
        // ~15 updates a second is smooth enough and keeps re-renders cheap.
        if (frame++ % 4 === 0) setLevel(levelRef.current)
        if (audio.current) audio.current.raf = requestAnimationFrame(meter)
      }

      const timer = window.setInterval(() => {
        if (modeRef.current !== 'listen' || filled.current < TARGET_RATE * 1.5) return
        // Unroll the newest `filled` samples into time order.
        const buf = ring.current
        const n = filled.current
        const window16 = new Float32Array(n)
        const start = (head.current - n + buf.length) % buf.length
        const firstPart = Math.min(n, buf.length - start)
        window16.set(buf.subarray(start, start + firstPart), 0)
        window16.set(buf.subarray(0, n - firstPart), firstPart)
        let sq = 0
        for (const v of window16) sq += v * v
        if (Math.sqrt(sq / window16.length) < SILENCE_RMS) return // silence: save the CPU
        const pcm = new Int16Array(window16.length)
        for (let k = 0; k < window16.length; k++) pcm[k] = Math.max(-32768, Math.min(32767, Math.round(window16[k] * 32767)))
        window.sc.ai.sendAudio(pcm.buffer)
      }, STEP_MS)

      audio.current = { stream, ctx, timer, raf: requestAnimationFrame(meter) }
      modeRef.current = next
      setMode(next)
    },
    [close, deviceId, scan]
  )

  const stop = useCallback(() => {
    close()
    modeRef.current = 'off'
    setMode('off')
  }, [close])

  useEffect(() => stop, [stop])

  // Re-open with the new input if it changes while the mic is on (deviceId only, not every render).
  useEffect(() => {
    if (modeRef.current !== 'off') void open(modeRef.current)
  }, [deviceId])

  const choose = (id: string) => {
    const label = devices.find((d) => d.deviceId === id)?.label ?? ''
    const next = { ...chosen, deviceId: id, label }
    setChosen(next)
    writeStored(next)
    setDeviceIdState(id)
    setNotice('')
    setNewInput(null)
  }

  return {
    devices,
    deviceId,
    setDeviceId: choose,
    channel: chosen.channel,
    setChannel: (channel) => {
      const next = { ...chosen, channel }
      setChosen(next)
      writeStored(next)
    },
    inputChannels,
    rescan: scan,
    newInput,
    dismissNewInput: () => setNewInput(null),
    notice,
    mode,
    level,
    status,
    lastHeard,
    heardLog,
    suggestions,
    error,
    test: () => open('test'),
    listen: async () => {
      setStatus(await window.sc.ai.start())
      await open('listen')
    },
    stop,
    dismiss: (key) => setSuggestions((l) => l.filter((s) => s.key !== key)),
    markUsed: (key) => setSuggestions((l) => l.map((s) => (s.key === key ? { ...s, used: true } : s))),
    clear: () => setSuggestions([]),
    testText: (text) => window.sc.ai.testText(text),
    aiMode,
    setAiMode: async (mode) => setAiModeState(await window.sc.ai.setMode(mode))
  }
}

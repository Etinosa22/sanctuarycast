// Microphone / mixer input for scripture detection. Opens the chosen input only
// while testing or listening, shows a level, and sends 16 kHz mono chunks to
// the speech engine in main. Suggestions come back here; nothing goes Live.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiMode, AiStatus, AiSuggestion } from '../../../shared/types'

const TARGET_RATE = 16_000
/** Send every 2 s the last 5 s of audio: overlap means no reference is cut in half. */
const STEP_MS = 2000
const WINDOW_SECONDS = 5
/** Below this RMS the chunk is treated as silence and not transcribed. */
const SILENCE_RMS = 0.006
const STORE_KEY = 'sc.audioInput'

export type MicMode = 'off' | 'test' | 'listen'

export interface Listening {
  devices: MediaDeviceInfo[]
  deviceId: string
  setDeviceId: (id: string) => void
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

const readStored = () => {
  try {
    return localStorage.getItem(STORE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** onAuto runs when the detector put a passage in Preview (or Live) by itself, so the console can show it. */
export function useListening(onAuto?: (s: AiSuggestion) => void): Listening {
  const onAutoRef = useRef(onAuto)
  onAutoRef.current = onAuto
  const [aiMode, setAiModeState] = useState<AiMode>('preview')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceIdState] = useState(readStored)
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

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices(all.filter((d) => d.kind === 'audioinput'))
  }, [])

  useEffect(() => {
    void refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    void window.sc.ai.status().then(setStatus)
    void window.sc.ai.getMode().then(setAiModeState)
    const off = window.sc.ai.onEvent((e) => {
      if (e.type === 'status') setStatus(e.status)
      else if (e.type === 'transcript') {
        const h = { text: e.text, ms: e.ms, at: Date.now() }
        setLastHeard(h)
        setHeardLog((log) => [h, ...log].slice(0, 12))
      }
      else {
        setSuggestions((list) => [e.suggestion, ...list.filter((s) => s.key !== e.suggestion.key && s.key !== e.suggestion.replaces)].slice(0, 25))
        if (e.suggestion.auto) onAutoRef.current?.(e.suggestion)
      }
    })
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
      off()
    }
  }, [refreshDevices])

  const close = useCallback(() => {
    const a = audio.current
    if (!a) return
    clearInterval(a.timer)
    cancelAnimationFrame(a.raf)
    a.stream.getTracks().forEach((t) => t.stop())
    void a.ctx.close()
    audio.current = null
    filled.current = 0
    head.current = 0
    setLevel(0)
  }, [])

  const open = useCallback(
    async (next: MicMode) => {
      close()
      setError('')
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            channelCount: 1,
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
      void refreshDevices()
      // Run the audio graph at 16 kHz so Chromium's own high-quality resampler does
      // the conversion; fall back to the device rate (and our averaging) if refused.
      let ctx: AudioContext
      try {
        ctx = new AudioContext({ sampleRate: TARGET_RATE })
      } catch {
        ctx = new AudioContext()
      }
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      // Collect samples, downsampled to 16 kHz by averaging, into a circular buffer.
      const ratio = ctx.sampleRate / TARGET_RATE
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      let carry = 0
      proc.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0)
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

      const samples = new Float32Array(analyser.fftSize)
      let frame = 0
      const meter = () => {
        // ~15 updates a second is smooth enough and keeps re-renders cheap.
        if (frame++ % 4 === 0) {
          analyser.getFloatTimeDomainData(samples)
          let sq = 0
          for (const v of samples) sq += v * v
          setLevel(Math.min(1, Math.sqrt(sq / samples.length) * 4))
        }
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
    [close, deviceId, refreshDevices]
  )

  const stop = useCallback(() => {
    close()
    modeRef.current = 'off'
    setMode('off')
  }, [close])

  useEffect(() => stop, [stop])

  const setDeviceId = (id: string) => {
    setDeviceIdState(id)
    try {
      localStorage.setItem(STORE_KEY, id)
    } catch {
      /* per-viewer convenience only */
    }
  }

  // Re-open with the new input if it changes while the mic is on (deviceId only, not every render).
  useEffect(() => {
    if (modeRef.current !== 'off') void open(modeRef.current)
  }, [deviceId])

  return {
    devices,
    deviceId,
    setDeviceId,
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

// Runs whisper.cpp's server as a separate process with the model loaded once,
// so speech-to-text never blocks the presentation engine. It listens on a
// random port on 127.0.0.1 only; no audio leaves the laptop.

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { cpus } from 'node:os'
import { encodeWav } from './wav'

export type EngineState = 'missing' | 'stopped' | 'starting' | 'ready' | 'error'

export interface EngineStatus {
  state: EngineState
  message: string
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })
}

export class WhisperSidecar {
  private proc: ChildProcess | null = null
  private port = 0
  private stopping = false
  private restarts = 0
  status: EngineStatus

  constructor(
    private bin: string,
    private model: string,
    private onStatus: (s: EngineStatus) => void = () => {}
  ) {
    this.status = this.installed()
      ? { state: 'stopped', message: 'Speech engine ready to start' }
      : { state: 'missing', message: 'Speech engine not installed (run scripts/fetch-whisper.mjs)' }
  }

  installed(): boolean {
    return existsSync(this.bin) && existsSync(this.model)
  }

  private set(state: EngineState, message: string): void {
    this.status = { state, message }
    this.onStatus(this.status)
  }

  async start(): Promise<void> {
    if (!this.installed()) return this.set('missing', 'Speech engine not installed (run scripts/fetch-whisper.mjs)')
    if (this.proc) return
    this.stopping = false
    this.port = await freePort()
    // Leave headroom for the presenter: at most 4 threads (the target i7 has 4).
    const threads = String(Math.max(1, Math.min(4, cpus().length - 1)))
    this.set('starting', 'Loading speech model…')
    // -ac 384 limits whisper to about 7.7 s of audio context for our 5 s chunks,
    // about 2.2 s per chunk on the dev PC instead of 4+ s for the default 30 s.
    // Going lower (256) was faster but made whisper loop on repeated phrases.
    // -mc 0: each chunk stands alone, so text from one chunk can't echo into the next.
    // -sns: ignore non-speech sounds.
    const args = ['-m', this.model, '--host', '127.0.0.1', '--port', String(this.port), '-t', threads, '-ac', '384', '-nt', '-l', 'en', '-mc', '0', '-sns']
    const proc = spawn(this.bin, args, {
      stdio: 'ignore',
      windowsHide: true
    })
    this.proc = proc
    proc.once('exit', (code) => {
      this.proc = null
      if (this.stopping) return
      this.set('error', `Speech engine stopped unexpectedly (code ${code}); restarting`)
      if (this.restarts++ < 5) setTimeout(() => void this.start(), 1500)
    })
    for (let i = 0; i < 150; i++) {
      if (this.proc !== proc) return
      try {
        await fetch(`http://127.0.0.1:${this.port}/`)
        this.restarts = 0
        return this.set('ready', 'Listening engine ready')
      } catch {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    this.set('error', 'Speech engine did not start in 30 s')
  }

  stop(): void {
    this.stopping = true
    if (!this.proc) return
    this.proc.kill()
    this.proc = null
    // Report it now; the exit event arrives a moment later.
    this.set('stopped', 'Speech engine stopped')
  }

  /** Transcribes 16 kHz mono PCM. Returns '' if the engine is not ready. */
  async transcribe(samples: Int16Array): Promise<string> {
    if (this.status.state !== 'ready') return ''
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(encodeWav(samples))], { type: 'audio/wav' }), 'chunk.wav')
    form.append('response_format', 'json')
    form.append('temperature', '0')
    const res = await fetch(`http://127.0.0.1:${this.port}/inference`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`whisper HTTP ${res.status}`)
    const body = (await res.json()) as { text?: string }
    return (body.text ?? '').trim()
  }
}

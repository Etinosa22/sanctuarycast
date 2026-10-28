// Crash-safe auto-save. Every change is written to a temp file and renamed over
// the old one, so a power cut never leaves a torn file. Writes are coalesced to
// one per event-loop turn so slide switches stay fast.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export class JsonStore<T> {
  private pending: T | null = null

  /** hydrate turns parsed JSON back into T, or null if it is unusable. */
  constructor(
    private file: string,
    private hydrate: (raw: unknown) => T | null
  ) {}

  load(): T | null {
    if (!existsSync(this.file)) return null
    try {
      return this.hydrate(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch (err) {
      console.error(`[persistence] could not read ${this.file}, starting fresh:`, err)
      return null
    }
  }

  save(value: T): void {
    const scheduled = this.pending !== null
    this.pending = value
    if (!scheduled) setImmediate(() => this.flush())
  }

  flush(): void {
    if (this.pending === null) return
    const value = this.pending
    this.pending = null
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, JSON.stringify(value))
      renameSync(tmp, this.file)
    } catch (err) {
      console.error('[persistence] auto-save failed:', err)
    }
  }
}

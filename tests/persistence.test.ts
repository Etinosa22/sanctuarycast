import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PresentationEngine } from '../src/main/engine/presentationEngine'
import { hydrateState } from '../src/main/engine/validate'
import { JsonStore } from '../src/main/persistence'
import type { PresentationState } from '../src/shared/types'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sc-test-'))
  file = join(dir, 'nested', 'session-state.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const stateStore = () => new JsonStore<PresentationState>(file, (raw) => hydrateState(raw, 5))

describe('JsonStore', () => {
  it('returns null when nothing was saved', () => {
    expect(stateStore().load()).toBeNull()
  })

  it('survives a restart at the last Live slide', () => {
    const engine = new PresentationEngine()
    const store = stateStore()
    engine.subscribe((s) => store.save(s))
    engine.dispatch({ type: 'stage', slide: { id: 'x', kind: 'song', text: 'Blessed assurance' } })
    engine.dispatch({ type: 'goLive' })
    engine.dispatch({ type: 'stage', slide: { id: 'y', kind: 'song', text: 'Next one' } })
    store.flush()

    const restored = stateStore().load()
    expect(restored?.live?.slide.text).toBe('Blessed assurance')
    expect(restored?.preview?.slide.text).toBe('Next one')
  })

  it('coalesces rapid saves into one write of the latest state', async () => {
    const engine = new PresentationEngine()
    const store = stateStore()
    engine.subscribe((s) => store.save(s))
    for (let i = 0; i < 20; i++) engine.dispatch({ type: 'toggleMask', mask: 'blank' })
    await new Promise((r) => setImmediate(r))
    expect(JSON.parse(readFileSync(file, 'utf8')).rev).toBe(20)
  })

  it('starts fresh from a corrupt file instead of failing', () => {
    const store = stateStore()
    store.save(new PresentationEngine().state)
    store.flush()
    writeFileSync(file, '{"live": {"slide":')
    expect(store.load()).toBeNull()
  })
})

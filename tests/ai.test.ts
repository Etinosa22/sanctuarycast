import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collapseRepeats, ReferenceDetector } from '../src/ai/detector'
import { encodeWav } from '../src/ai/wav'
import { WhisperSidecar } from '../src/ai/whisperSidecar'

describe('ReferenceDetector', () => {
  it('suggests each reference once even though overlapping chunks repeat it', () => {
    let now = 0
    const d = new ReferenceDetector(() => now)
    expect(d.feed('turn to John 3:16', { complete: true }).map((s) => s.key)).toEqual(['John 3:16'])
    now += 2000
    expect(d.feed('to John 3:16 for God so loved')).toEqual([])
  })

  it('suggests it again once the repeat window has passed', () => {
    let now = 0
    const d = new ReferenceDetector(() => now, 45_000)
    d.feed('John 3:16', { complete: true })
    now += 46_000
    expect(d.feed('John 3:16', { complete: true }).map((s) => s.key)).toEqual(['John 3:16'])
  })

  it('marks a verse that follows its chapter as replacing the chapter card', () => {
    const d = new ReferenceDetector(() => 0)
    expect(d.feed('turn with me to Romans chapter 8', { complete: true }).map((s) => s.key)).toEqual(['Romans 8'])
    const [v] = d.feed('chapter 8 verse 28', { complete: true })
    expect(v).toMatchObject({ key: 'Romans 8:28', replaces: 'Romans 8', source: 'context' })
  })

  it('keeps the chapter between chunks so "verse 8" works across a chunk boundary', () => {
    const d = new ReferenceDetector(() => 0)
    d.feed('the book of Ephesians chapter 2', { complete: true })
    expect(d.feed('look at verse 8', { complete: true }).map((s) => s.key)).toEqual(['Ephesians 2:8'])
  })

  it('takes context from outside, e.g. the passage on Live', () => {
    const d = new ReferenceDetector(() => 0)
    d.setContext({ book: 43, chapter: 3 })
    expect(d.feed('now verse 17', { complete: true }).map((s) => s.key)).toEqual(['John 3:17'])
    d.reset()
    expect(d.feed('now verse 17', { complete: true })).toEqual([])
  })
})

describe('references at the edge of an audio chunk', () => {
  it('holds one heard at the very end until the next chunk confirms it', () => {
    let now = 0
    const d = new ReferenceDetector(() => now)
    expect(d.feed('later we will read Romans 8, 28.')).toEqual([])
    now += 2000
    expect(d.feed('we will read Romans 8, 28.').map((s) => s.key)).toEqual(['Romans 8:28'])
  })

  it('a cut-off number is never suggested once the next chunk hears the real one', () => {
    let now = 0
    const d = new ReferenceDetector(() => now)
    expect(d.feed('later we will read Romans 8 20')).toEqual([]) // twenty of a cut twenty-eight
    now += 2000
    expect(d.feed('read Romans 8 28 and 1 Corinthians').map((s) => s.key)).toEqual(['Romans 8:28'])
    now += 10_000
    expect(d.feed('something else entirely')).toEqual([])
  })

  it('emits at once when speech continues after the reference', () => {
    const d = new ReferenceDetector(() => 0)
    expect(d.feed('turn to John 3:16 for God so loved the world').map((s) => s.key)).toEqual(['John 3:16'])
  })

  it('a chapter followed by its verse in the next chunk gives just the verse card', () => {
    let now = 0
    const d = new ReferenceDetector(() => now)
    expect(d.feed('Turn with me to the Book of John, Chapter 3.')).toEqual([])
    now += 2000
    expect(d.feed('Book of John, Chapter 3, verse 16. And then').map((s) => s.key)).toEqual(['John 3:16'])
  })
})

describe('whisper repetition loops', () => {
  it('collapses a phrase repeated back to back', () => {
    expect(collapseRepeats('chapter 3, verse 16. And then go down to verse 18. And then go down to verse 18.')).toBe(
      'chapter 3, verse 16. And then go down to verse 18.'
    )
    expect(collapseRepeats('read Romans 8 and then go down read Romans 8 and then go down read Romans 8 and then go down')).toBe('read Romans 8 and then go down')
  })

  it('leaves normal speech and short repeats alone', () => {
    expect(collapseRepeats('Holy, holy, holy! Lord God Almighty')).toBe('Holy, holy, holy! Lord God Almighty')
    expect(collapseRepeats('John 3:16 and John 3:17')).toBe('John 3:16 and John 3:17')
  })

  it('a looped transcript gives each reference once', () => {
    let now = 0
    const d = new ReferenceDetector(() => now)
    expect(d.feed('the Book of John, chapter 3, verse 16. And then').map((s) => s.key)).toEqual(['John 3:16'])
    now += 2000
    expect(
      d.feed('go down to verse 18. Later we will read Romans 8:28. Later we will read Romans 8:28. Later we will read Romans 8:28 and').map((s) => s.key)
    ).toEqual(['John 3:18', 'Romans 8:28'])
  })
})

describe('encodeWav', () => {
  it('writes a 16 kHz mono 16-bit PCM header', () => {
    const wav = encodeWav(new Int16Array([0, 1000, -1000]))
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(16_000)
    expect(wav.readUInt16LE(34)).toBe(16)
    expect(wav.readUInt32LE(40)).toBe(6)
    expect(wav.readInt16LE(46)).toBe(1000)
    expect(wav.length).toBe(50)
  })
})

const AI = join(__dirname, '..', 'resources', 'ai')
const BIN = join(AI, 'bin', 'whisper-server.exe')
const MODEL = join(AI, 'models', 'ggml-base.en-q5_1.bin')
const engineInstalled = process.platform === 'win32' && existsSync(BIN) && existsSync(MODEL)

describe.skipIf(!engineInstalled)('whisper sidecar (end to end)', () => {
  it('hears "Philippians four thirteen" and the detector suggests Philippians 4:13', async () => {
    const statuses: string[] = []
    const sidecar = new WhisperSidecar(BIN, MODEL, (s) => statuses.push(s.state))
    try {
      await sidecar.start()
      expect(sidecar.status.state).toBe('ready')
      // Fixture: Windows text-to-speech saying "Open your Bibles to Philippians four thirteen."
      const wav = readFileSync(join(__dirname, 'fixtures', 'philippians-4-13.wav'))
      // Find the data chunk; Windows speech output uses a longer header than 44 bytes.
      const dataAt = wav.indexOf('data') + 8
      const pcm = new Int16Array(wav.buffer.slice(wav.byteOffset + dataAt, wav.byteOffset + wav.length - ((wav.length - dataAt) % 2)))
      const text = await sidecar.transcribe(pcm)
      expect(text.toLowerCase()).toContain('philippians')
      expect(new ReferenceDetector().feed(text, { complete: true }).map((s) => s.key)).toEqual(['Philippians 4:13'])
      expect(statuses).toEqual(['starting', 'ready'])
    } finally {
      sidecar.stop()
    }
  }, 60_000)

  it('reports a missing engine instead of crashing', async () => {
    const s = new WhisperSidecar(join(AI, 'nope.exe'), MODEL)
    expect(s.status.state).toBe('missing')
    await s.start()
    expect(s.status.state).toBe('missing')
    expect(await s.transcribe(new Int16Array(10))).toBe('')
  })
})

// Downloads the offline speech engine into resources/ai (not kept in git):
//   whisper.cpp b5454 Windows x64 CPU build (8.9 MB) from the official GitHub release
//   ggml-base.en-q5_1.bin model (59.7 MB) from huggingface.co/ggerganov/whisper.cpp
// Both are checked against known SHA-256 hashes before use.
// Usage (Windows): node scripts/fetch-whisper.mjs

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'ai')
const FILES = {
  zip: {
    url: 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip',
    sha256: '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb'
  },
  model: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin',
    sha256: '4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f'
  }
}

async function download({ url, sha256 }, to) {
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const got = createHash('sha256').update(buf).digest('hex')
  if (got !== sha256) throw new Error(`${url}: checksum mismatch (${got})`)
  writeFileSync(to, buf)
}

const work = mkdtempSync(join(tmpdir(), 'sc-whisper-'))
try {
  mkdirSync(join(ROOT, 'bin'), { recursive: true })
  mkdirSync(join(ROOT, 'models'), { recursive: true })

  const model = join(ROOT, 'models', 'ggml-base.en-q5_1.bin')
  if (!existsSync(model)) await download(FILES.model, model)
  else console.log('Model already present')

  const zip = join(work, 'whisper.zip')
  await download(FILES.zip, zip)
  const unzipped = join(work, 'unzipped')
  execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${unzipped}' -Force`])
  const release = join(unzipped, 'Release')
  // Only the server and its libraries; the zip's demos and tests stay out.
  const wanted = readdirSync(release).filter((f) => f === 'whisper-server.exe' || f.endsWith('.dll'))
  for (const f of wanted) copyFileSync(join(release, f), join(ROOT, 'bin', f))
  console.log(`Installed ${wanted.length} files into ${join(ROOT, 'bin')}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}

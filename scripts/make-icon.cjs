// Renders the SanctuaryCast logo (same artwork as console/icons.tsx) to
// build/icon.png at 512x512 for electron-builder.
// Usage: npx electron scripts/make-icon.cjs

const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 512
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 32 32">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d88f8"/><stop offset="1" stop-color="#5a40c4"/></linearGradient></defs>
  <rect width="32" height="32" rx="7" fill="url(#g)"/>
  <path d="M16 6.5v19M10 12.3h12" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
</svg>`
const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: SIZE, height: SIZE, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  const out = join(__dirname, '..', 'build', 'icon.png')
  mkdirSync(join(__dirname, '..', 'build'), { recursive: true })
  writeFileSync(out, image.resize({ width: SIZE, height: SIZE }).toPNG())
  console.log(`Wrote ${out}`)
  app.quit()
})

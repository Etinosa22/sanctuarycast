// Creates the console, Main Output and Stage Display windows and places them
// on the right displays. Outputs are passive: they render what main sends.

import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import type { DisplaySummary, WindowRole } from '../shared/types'
import { manualStagePlacement, planOutputs, type DisplayInfo, type OutputPlan, type Placement } from './displays'

function currentPlan(): OutputPlan {
  const toInfo = (d: Electron.Display): DisplayInfo => ({ id: d.id, bounds: d.bounds, workArea: d.workArea })
  return planOutputs(screen.getAllDisplays().map(toInfo), screen.getPrimaryDisplay().id)
}

function loadRole(win: BrowserWindow, role: WindowRole): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(`${devUrl}#${role}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: role })
}

function createWindow(role: WindowRole, placement: Placement | null): BrowserWindow {
  const area = placement?.display.workArea
  const testSize = role === 'console' ? { width: 1400, height: 860 } : { width: 640, height: 360 }
  const win = new BrowserWindow({
    title: { console: 'SanctuaryCast', output: 'SanctuaryCast — Main Output', stage: 'SanctuaryCast — Stage Display' }[role],
    show: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    ...(placement?.fullscreen
      ? { ...placement.display.bounds, fullscreen: true, frame: false }
      : area
        ? { ...testSize, x: area.x + (role === 'stage' ? 700 : 40), y: area.y + (role === 'console' ? 20 : 60) }
        : testSize),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      additionalArguments: [`--sc-role=${role}`],
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Outputs are never focused; keep them rendering at full speed anyway.
      backgroundThrottling: role === 'console'
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  // Outputs appear without stealing keyboard focus from the operator console.
  win.once('ready-to-show', () => {
    if (role !== 'console') return win.showInactive()
    // The console gets the whole operator screen.
    win.maximize()
    win.show()
  })
  loadRole(win, role)
  return win
}

export class WindowManager {
  private windows: Partial<Record<WindowRole, BrowserWindow>> = {}
  private plan: OutputPlan = currentPlan()

  /** Called once a window is ready to receive state, e.g. on load. */
  onReady: (win: BrowserWindow, role: WindowRole) => void = () => {}

  start(): void {
    this.windows.console = createWindow('console', { display: this.plan.console, fullscreen: false })
    this.windows.console.on('closed', () => {
      // Closing the console ends the session; outputs go with it.
      this.close('output')
      this.close('stage')
      delete this.windows.console
    })
    this.openOutputs()
    screen.on('display-added', () => this.relayout())
    screen.on('display-removed', () => this.relayout())
  }

  roleOf(webContentsId: number): WindowRole | null {
    for (const [role, win] of Object.entries(this.windows)) {
      if (win && !win.isDestroyed() && win.webContents.id === webContentsId) return role as WindowRole
    }
    return null
  }

  get(role: WindowRole): BrowserWindow | undefined {
    const win = this.windows[role]
    return win && !win.isDestroyed() ? win : undefined
  }

  /** Brings back a Main Output closed by hand, and a planned stage display. */
  reopenOutputs(): void {
    const output = this.get('output')
    if (output) output.showInactive()
    else this.open('output', this.plan.main)
    if (this.plan.stage && !this.get('stage')) this.open('stage', this.plan.stage)
  }

  openStage(): void {
    const existing = this.get('stage')
    if (existing) return existing.showInactive()
    this.open('stage', manualStagePlacement(this.plan))
  }

  summary(): DisplaySummary {
    const describe = (role: WindowRole): string => {
      if (!this.get(role)) return 'closed'
      const p = role === 'output' ? this.plan.main : manualStagePlacement(this.plan)
      return p.fullscreen ? `full screen on display ${p.display.bounds.width}x${p.display.bounds.height}` : 'test window'
    }
    return { count: screen.getAllDisplays().length, mainOutput: describe('output'), stageOutput: describe('stage') }
  }

  private openOutputs(): void {
    this.open('output', this.plan.main)
    if (this.plan.stage) this.open('stage', this.plan.stage)
  }

  private open(role: WindowRole, placement: Placement): void {
    const win = createWindow(role, placement)
    this.windows[role] = win
    win.webContents.on('did-finish-load', () => this.onReady(win, role))
    win.on('closed', () => {
      if (this.windows[role] === win) delete this.windows[role]
    })
  }

  private close(role: WindowRole): void {
    this.get(role)?.close()
    delete this.windows[role]
  }

  /** A projector was plugged in or removed: rebuild the outputs on the new layout. */
  private relayout(): void {
    if (!this.get('console')) return
    const stageWasOpen = Boolean(this.get('stage'))
    this.plan = currentPlan()
    this.close('output')
    this.close('stage')
    this.openOutputs()
    if (stageWasOpen && !this.get('stage')) this.openStage()
  }
}

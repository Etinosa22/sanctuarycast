// Electron main process entry: owns the presentation engine, the service order,
// auto-save and IPC.

import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PresentationState, ServiceState, WindowRole } from '../shared/types'
import { bookIdFromName } from '../parser/reference'
import { mediaPathFromUrl } from './backgrounds'
import { BibleLibrary } from './bible/bibleLibrary'
import { Library } from './db/library'
import { PresentationEngine, toOutputView, toStageView } from './engine/presentationEngine'
import { hydrateService, hydrateState, isEngineAction, isServiceAction } from './engine/validate'
import { registerLibraryIpc } from './library'
import { JsonStore } from './persistence'
import { demoService, demoSongs } from './service/demoService'
import { ServiceOrder } from './service/serviceOrder'
import { WindowManager } from './windows'

// Imported backgrounds are served from the app folder through this scheme only.
protocol.registerSchemesAsPrivileged([{ scheme: 'sc-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }])

if (!app.requestSingleInstanceLock()) {
  // A second copy would fight the first for the projector.
  app.quit()
} else {
  void app.whenReady().then(start)
}

/** Bundled read-only data: resources/ in dev, the installer's resources folder when packaged. */
const resourcePath = (...parts: string[]) =>
  app.isPackaged ? join(process.resourcesPath, ...parts) : join(app.getAppPath(), 'resources', ...parts)

function start(): void {
  const dataDir = app.getPath('userData')
  const mediaDir = join(dataDir, 'backgrounds')
  protocol.handle('sc-media', (req) => {
    const path = mediaPathFromUrl(req.url, mediaDir)
    return path ? net.fetch(pathToFileURL(path).toString()) : new Response('Not found', { status: 404 })
  })

  const bibles = new BibleLibrary(resourcePath('bibles'), join(dataDir, 'bibles'), bookIdFromName)
  const library = new Library(join(dataDir, 'library.sqlite'))
  library.seedOnce('starter-songs', () => demoSongs().forEach((s) => library.saveSong(s)))
  const stateStore = new JsonStore<PresentationState>(join(dataDir, 'session-state.json'), (raw) => hydrateState(raw, Date.now()))
  const serviceStore = new JsonStore<ServiceState>(join(dataDir, 'service.json'), hydrateService)

  // After a crash or restart, reopen exactly where Live was.
  const engine = new PresentationEngine(stateStore.load() ?? undefined)
  const service = new ServiceOrder(serviceStore.load() ?? demoService())
  const windows = new WindowManager()

  const viewFor = (role: WindowRole) => {
    const s = engine.state
    return role === 'console' ? s : role === 'output' ? toOutputView(s) : toStageView(s)
  }
  const send = (win: BrowserWindow, role: WindowRole) => win.webContents.send('state', viewFor(role))

  engine.subscribe((state) => {
    stateStore.save(state)
    for (const role of ['output', 'stage', 'console'] as const) {
      const win = windows.get(role)
      if (win) send(win, role)
    }
  })
  service.subscribe((s) => {
    serviceStore.save(s)
    windows.get('console')?.webContents.send('service', s)
  })
  windows.onReady = send

  const fromConsole = (e: Electron.IpcMainInvokeEvent) => windows.roleOf(e.sender.id) === 'console'

  ipcMain.handle('state:get', (e) => {
    const role = windows.roleOf(e.sender.id)
    return role ? viewFor(role) : null
  })

  ipcMain.handle('engine:dispatch', (e, action: unknown) => {
    // Only the operator console may change what is shown.
    if (!fromConsole(e)) return
    if (!isEngineAction(action)) {
      console.warn('[engine] rejected malformed action', action)
      return
    }
    engine.dispatch(action)
  })

  ipcMain.handle('service:get', (e) => (fromConsole(e) ? service.state : null))

  ipcMain.handle('service:dispatch', (e, action: unknown) => {
    if (!fromConsole(e)) return
    if (!isServiceAction(action)) {
      console.warn('[service] rejected malformed action', action)
      return
    }
    service.dispatch(action)
  })

  ipcMain.handle('windows:openStage', (e) => {
    if (fromConsole(e)) windows.openStage()
  })

  ipcMain.handle('windows:reopenOutputs', (e) => {
    if (fromConsole(e)) windows.reopenOutputs()
  })

  ipcMain.handle('displays:get', () => windows.summary())

  registerLibraryIpc({
    bibles,
    library,
    mediaDir,
    engineState: () => engine.state,
    consoleFor: (id) => (windows.roleOf(id) === 'console' ? (windows.get('console') ?? null) : null)
  })

  windows.start()

  app.on('before-quit', () => {
    stateStore.flush()
    serviceStore.flush()
    library.close()
    bibles.close()
  })
  app.on('window-all-closed', () => app.quit())
}

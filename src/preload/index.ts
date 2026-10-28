// Bridge between a sandboxed renderer and the main process. Exposes window.sc.

import { contextBridge, ipcRenderer } from 'electron'
import type { ScApi, WindowRole } from '../shared/types'

const roleArg = process.argv.find((a) => a.startsWith('--sc-role='))
const role = (roleArg?.split('=')[1] ?? 'output') as WindowRole

const api: ScApi = {
  role,
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, state: Parameters<typeof cb>[0]) => cb(state)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
  dispatch: (action) => ipcRenderer.invoke('engine:dispatch', action),
  getService: () => ipcRenderer.invoke('service:get'),
  onService: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, service: Parameters<typeof cb>[0]) => cb(service)
    ipcRenderer.on('service', listener)
    return () => ipcRenderer.removeListener('service', listener)
  },
  dispatchService: (action) => ipcRenderer.invoke('service:dispatch', action),
  openStage: () => ipcRenderer.invoke('windows:openStage'),
  reopenOutputs: () => ipcRenderer.invoke('windows:reopenOutputs'),
  bible: {
    search: (query) => ipcRenderer.invoke('bible:search', query)
  },
  songs: {
    list: (filter) => ipcRenderer.invoke('songs:list', filter),
    get: (id) => ipcRenderer.invoke('songs:get', id),
    save: (song) => ipcRenderer.invoke('songs:save', song),
    remove: (id) => ipcRenderer.invoke('songs:remove', id)
  },
  backgrounds: {
    list: () => ipcRenderer.invoke('backgrounds:list'),
    importFiles: () => ipcRenderer.invoke('backgrounds:importFiles'),
    addColour: (colour) => ipcRenderer.invoke('backgrounds:addColour', colour),
    remove: (id) => ipcRenderer.invoke('backgrounds:remove', id)
  },
  themes: {
    list: () => ipcRenderer.invoke('themes:list'),
    save: (name, theme) => ipcRenderer.invoke('themes:save', name, theme),
    remove: (id) => ipcRenderer.invoke('themes:remove', id)
  },
  getDisplays: () => ipcRenderer.invoke('displays:get')
}

contextBridge.exposeInMainWorld('sc', api)

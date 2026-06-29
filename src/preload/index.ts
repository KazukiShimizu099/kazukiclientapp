import { contextBridge, ipcRenderer } from 'electron'

if (!process.contextIsolated) {
  throw new Error('contextIsolation must be enabled in the BrowserWindow')
}

try {
  contextBridge.exposeInMainWorld('kazuki', {
    // 1. INSTANCE HANDLERS
    instance: {
      create: (data: any) => ipcRenderer.invoke('instance:create', data),
      getAll: () => ipcRenderer.invoke('instance:get-all'),
      delete: (id: string) => ipcRenderer.invoke('instance:delete', id),
      update: (data: {id: string, data: any}) => ipcRenderer.invoke('instance:update', data),
      launch: (id: string) => ipcRenderer.invoke('instance:launch', id),
      openFolder: (id: string) => ipcRenderer.invoke('instance:open-folder', id)
    },
    
    // 2. VERSIONS HANDLERS
    versions: {
      getList: () => ipcRenderer.invoke('versions:get-list'),
      install: (id: string) => ipcRenderer.invoke('versions:install', id)
    },

    // 3. SETTINGS HANDLERS (Ye missing the, isiliye accounts glitch kar rahe the)
    settings: {
      get: (key?: string) => ipcRenderer.invoke('settings:get', key),
      set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value)
    },

    // 4. AUTHENTICATION HANDLERS (Ye missing the)
    auth: {
      getAccount: () => ipcRenderer.invoke('auth:get-account'),
      login: (type: string) => ipcRenderer.invoke('auth:login', type),
      logout: () => ipcRenderer.invoke('auth:logout')
    },

    // 5. MOD MANAGER HANDLERS (Ye missing the, mod page block tha)
    mods: {
      search: (query: string, loader: string, version: string) => ipcRenderer.invoke('mods:search', query, loader, version),
      install: (projectId: string, versionId: string, instanceId: string) => ipcRenderer.invoke('mods:install', projectId, versionId, instanceId),
      uninstall: (modId: string, instanceId: string) => ipcRenderer.invoke('mods:uninstall', modId, instanceId),
      getInstalled: (instanceId: string) => ipcRenderer.invoke('mods:get-installed', instanceId)
    },

    // EVENT LISTENERS
    on: (channel: string, callback: (...args: any[]) => void) => {
      const subscription = (_event: any, ...args: any[]) => callback(...args)
      ipcRenderer.on(channel, subscription)
    },
    off: (channel: string) => {
      ipcRenderer.removeAllListeners(channel)
    }
  })
} catch (error) {
  console.error(error)
}
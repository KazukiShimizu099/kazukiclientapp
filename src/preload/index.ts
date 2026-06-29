import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('kazuki', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },
  auth: {
    microsoftStart: ()                => ipcRenderer.invoke('auth:microsoft-start'),
    microsoftPoll:  (data:any)        => ipcRenderer.invoke('auth:microsoft-poll', data),
    offlineLogin:   (u:string)        => ipcRenderer.invoke('auth:offline-login', u),
    logout:         ()                => ipcRenderer.invoke('auth:logout'),
    getAccount:     ()                => ipcRenderer.invoke('auth:get-account'),
    getSkinHead:    (uuid:string)     => ipcRenderer.invoke('auth:get-skin-head', uuid),
  },
  versions: {
    getList: ()                       => ipcRenderer.invoke('versions:get-list'),
    install: (versionId:string)       => ipcRenderer.invoke('versions:install', versionId),
  },
  instance: {
    create:  (data:any)               => ipcRenderer.invoke('instance:create', data),
    delete:  (id:string)              => ipcRenderer.invoke('instance:delete', id),
    getAll:  ()                       => ipcRenderer.invoke('instance:get-all'),
    launch:  (id:string)              => ipcRenderer.invoke('instance:launch', id),
  },
  mods: {
    search:       (data:any) => ipcRenderer.invoke('mods:search', data),
    install:      (data:any) => ipcRenderer.invoke('mods:install', data),
    getInstalled: (instId:string) => ipcRenderer.invoke('mods:get-installed', instId),
    remove:       (data:any) => ipcRenderer.invoke('mods:remove', data),
  },
  settings: {
    get:        ()                    => ipcRenderer.invoke('settings:get'),
    set:        (k:string,v:any)      => ipcRenderer.invoke('settings:set',{key:k,value:v}),
    systemInfo: ()                    => ipcRenderer.invoke('settings:system-info'),
  },
  discord: {
    getConfig:  ()                    => ipcRenderer.invoke('discord:get-config'),
    setConfig:  (cfg:any)             => ipcRenderer.invoke('discord:set-config',cfg),
    setState:   (s:any)               => ipcRenderer.invoke('discord:set-state',s),
    reconnect:  ()                    => ipcRenderer.invoke('discord:reconnect'),
    getStatus:  ()                    => ipcRenderer.invoke('discord:get-status'),
  },
  on:  (channel:string, cb:(...args:any[])=>void) => {
    const h = (_:any,...a:any[]) => cb(...a)
    ipcRenderer.on(channel,h)
    return h
  },
  off: (channel:string) => ipcRenderer.removeAllListeners(channel),
})
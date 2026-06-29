"use strict";
const electron = require("electron");
if (!process.contextIsolated) {
  throw new Error("contextIsolation must be enabled in the BrowserWindow");
}
try {
  electron.contextBridge.exposeInMainWorld("kazuki", {
    // 1. INSTANCE HANDLERS
    instance: {
      create: (data) => electron.ipcRenderer.invoke("instance:create", data),
      getAll: () => electron.ipcRenderer.invoke("instance:get-all"),
      delete: (id) => electron.ipcRenderer.invoke("instance:delete", id),
      update: (data) => electron.ipcRenderer.invoke("instance:update", data),
      launch: (id) => electron.ipcRenderer.invoke("instance:launch", id),
      openFolder: (id) => electron.ipcRenderer.invoke("instance:open-folder", id)
    },
    // 2. VERSIONS HANDLERS
    versions: {
      getList: () => electron.ipcRenderer.invoke("versions:get-list"),
      install: (id) => electron.ipcRenderer.invoke("versions:install", id)
    },
    // 3. SETTINGS HANDLERS (Ye missing the, isiliye accounts glitch kar rahe the)
    settings: {
      get: (key) => electron.ipcRenderer.invoke("settings:get", key),
      set: (key, value) => electron.ipcRenderer.invoke("settings:set", key, value)
    },
    // 4. AUTHENTICATION HANDLERS (Ye missing the)
    auth: {
      getAccount: () => electron.ipcRenderer.invoke("auth:get-account"),
      login: (type) => electron.ipcRenderer.invoke("auth:login", type),
      logout: () => electron.ipcRenderer.invoke("auth:logout")
    },
    // 5. MOD MANAGER HANDLERS (Ye missing the, mod page block tha)
    mods: {
      search: (query, loader, version) => electron.ipcRenderer.invoke("mods:search", query, loader, version),
      install: (projectId, versionId, instanceId) => electron.ipcRenderer.invoke("mods:install", projectId, versionId, instanceId),
      uninstall: (modId, instanceId) => electron.ipcRenderer.invoke("mods:uninstall", modId, instanceId),
      getInstalled: (instanceId) => electron.ipcRenderer.invoke("mods:get-installed", instanceId)
    },
    // EVENT LISTENERS
    on: (channel, callback) => {
      const subscription = (_event, ...args) => callback(...args);
      electron.ipcRenderer.on(channel, subscription);
    },
    off: (channel) => {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  });
} catch (error) {
  console.error(error);
}

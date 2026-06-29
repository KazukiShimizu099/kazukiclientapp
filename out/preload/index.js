"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("kazuki", {
  window: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    close: () => electron.ipcRenderer.send("window:close")
  },
  auth: {
    microsoftStart: () => electron.ipcRenderer.invoke("auth:microsoft-start"),
    microsoftPoll: (data) => electron.ipcRenderer.invoke("auth:microsoft-poll", data),
    offlineLogin: (u) => electron.ipcRenderer.invoke("auth:offline-login", u),
    logout: () => electron.ipcRenderer.invoke("auth:logout"),
    getAccount: () => electron.ipcRenderer.invoke("auth:get-account"),
    getSkinHead: (uuid) => electron.ipcRenderer.invoke("auth:get-skin-head", uuid)
  },
  versions: {
    getList: () => electron.ipcRenderer.invoke("versions:get-list"),
    install: (versionId) => electron.ipcRenderer.invoke("versions:install", versionId)
  },
  instance: {
    create: (data) => electron.ipcRenderer.invoke("instance:create", data),
    delete: (id) => electron.ipcRenderer.invoke("instance:delete", id),
    getAll: () => electron.ipcRenderer.invoke("instance:get-all"),
    launch: (id) => electron.ipcRenderer.invoke("instance:launch", id),
    openFolder: (id) => electron.ipcRenderer.invoke("instance:open-folder", id)
  },
  mods: {
    search: (data) => electron.ipcRenderer.invoke("mods:search", data),
    install: (data) => electron.ipcRenderer.invoke("mods:install", data),
    getInstalled: (instId) => electron.ipcRenderer.invoke("mods:get-installed", instId),
    remove: (data) => electron.ipcRenderer.invoke("mods:remove", data)
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    set: (k, v) => electron.ipcRenderer.invoke("settings:set", { key: k, value: v }),
    systemInfo: () => electron.ipcRenderer.invoke("settings:system-info")
  },
  on: (channel, cb) => {
    const h = (_, ...a) => cb(...a);
    electron.ipcRenderer.on(channel, h);
    return h;
  },
  off: (channel) => electron.ipcRenderer.removeAllListeners(channel)
});

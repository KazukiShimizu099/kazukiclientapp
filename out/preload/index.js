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
    launch: (id) => electron.ipcRenderer.invoke("instance:launch", id)
  },
  mods: {
    search: (q, src, ver) => electron.ipcRenderer.invoke("mods:search", { query: q, source: src, mcVersion: ver }),
    install: (mod, instId) => electron.ipcRenderer.invoke("mods:install", { mod, instanceId: instId }),
    getInstalled: (instId) => electron.ipcRenderer.invoke("mods:get-installed", instId),
    remove: (modId, instId) => electron.ipcRenderer.invoke("mods:remove", { modId, instanceId: instId })
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    set: (k, v) => electron.ipcRenderer.invoke("settings:set", { key: k, value: v }),
    systemInfo: () => electron.ipcRenderer.invoke("settings:system-info")
  },
  discord: {
    getConfig: () => electron.ipcRenderer.invoke("discord:get-config"),
    setConfig: (cfg) => electron.ipcRenderer.invoke("discord:set-config", cfg),
    setState: (s) => electron.ipcRenderer.invoke("discord:set-state", s),
    reconnect: () => electron.ipcRenderer.invoke("discord:reconnect"),
    getStatus: () => electron.ipcRenderer.invoke("discord:get-status")
  },
  on: (channel, cb) => {
    const h = (_, ...a) => cb(...a);
    electron.ipcRenderer.on(channel, h);
    return h;
  },
  off: (channel) => electron.ipcRenderer.removeAllListeners(channel)
});

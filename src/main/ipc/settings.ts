import { IpcMain } from 'electron'
import { app } from 'electron'
import * as path from 'path'
import * as os from 'os'
import type { LauncherSettings } from '../../shared/types'

function getDefaultGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

function getAutoRam(): number {
  // Auto detect: use 50% of system RAM, capped at 6GB, min 2GB
  const totalRamGB = os.totalmem() / 1024 / 1024 / 1024
  const recommended = Math.floor(totalRamGB * 0.5) * 1024
  return Math.min(Math.max(recommended, 2048), 6144)
}

function getDefaultSettings(): LauncherSettings {
  return {
    closeOnLaunch: false,
    discordRpc: true,
    autoUpdate: true,
    defaultMaxRam: getAutoRam(),
    defaultMinRam: 512,
    javaPath: '',
    gameDir: getDefaultGameDir(),
    sendCrashReports: true,
    theme: 'dark'
  }
}

export function setupSettingsHandlers(ipcMain: IpcMain, store: any) {
  ipcMain.handle('settings:get', async () => {
    const defaults = getDefaultSettings()
    const stored = store.get('settings', {})
    // Merge with defaults so new settings auto-apply
    const settings = { ...defaults, ...stored }
    return { success: true, settings }
  })

  ipcMain.handle('settings:set', async (_, { key, value }: { key: string; value: any }) => {
    const defaults = getDefaultSettings()
    const stored = store.get('settings', {})
    const settings = { ...defaults, ...stored, [key]: value }
    store.set('settings', settings)
    return { success: true }
  })

  // Get system info for display
  ipcMain.handle('settings:system-info', async () => {
    const totalRam = Math.round(os.totalmem() / 1024 / 1024 / 1024)
    const cpus = os.cpus()
    const cpu = cpus[0]?.model || 'Unknown'
    const platform = os.platform()
    const arch = os.arch()
    const autoRam = getAutoRam()
    return { totalRam, cpu, platform, arch, autoRam }
  })
}

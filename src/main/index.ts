import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { setupAuthHandlers } from './auth/handlers'
import { setupVersionHandlers } from './versions/handlers'
import { setupInstanceHandlers } from './launcher/handlers'
import { setupModHandlers } from './mods/handlers'
import { setupSettingsHandlers } from './ipc/settings'
import { setupDiscordHandlers } from './discord/handlers'
import Store from 'electron-store'

const store = new Store()
let mainWindow: BrowserWindow | null = null
const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 720,
    minWidth: 960, minHeight: 600,
    frame: false, transparent: false,
    backgroundColor: '#010205',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
}

app.whenReady().then(() => {
  createWindow()
  setupAuthHandlers(ipcMain, store)
  setupVersionHandlers(ipcMain, store)
  setupInstanceHandlers(ipcMain, store, mainWindow)
  setupModHandlers(ipcMain, store)
  setupSettingsHandlers(ipcMain, store)
  setupDiscordHandlers(ipcMain, store)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

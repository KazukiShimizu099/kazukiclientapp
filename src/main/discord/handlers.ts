import { Client } from 'discord-rpc'
import { IpcMain } from 'electron'

// Note: Tujhe Discord Developer Portal se apna Client ID yahan daalna padega
const clientId = '1521010841774981160' 
let rpc: Client | null = null
let isReady = false

export function setDiscordActivity(details: string, state: string, inGame: boolean = false) {
  if (!rpc || !isReady) return
  rpc.setActivity({
    details,
    state,
    startTimestamp: new Date(), // Fresh timestamp forces priority
    largeImageKey: 'logo',
    largeImageText: 'Kazuki Client',
    instance: inGame // CRITICAL: Tells Discord this is an active game session
  }).catch(() => {})
}

export function setupDiscordHandlers(ipcMain: IpcMain, store: any) {
  rpc = new Client({ transport: 'ipc' })
  
  rpc.on('ready', () => {
    isReady = true
    setDiscordActivity('In Launcher', 'Browsing Instances', false)
  })
  
  rpc.login({ clientId }).catch(() => {
    console.log("Discord RPC not running or failed to connect.")
  })
}
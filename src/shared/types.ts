// ─── Account Types ────────────────────────────────────────────────────────────
export interface MicrosoftAccount {
  type: 'microsoft'
  username: string
  uuid: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface OfflineAccount {
  type: 'offline'
  username: string
  uuid: string
}

export type Account = MicrosoftAccount | OfflineAccount

// ─── Version Types ────────────────────────────────────────────────────────────
export type LoaderType = 'vanilla' | 'fabric' | 'forge'

export interface MCVersion {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  releaseTime: string
}

export interface Instance {
  id: string
  name: string
  mcVersion: string
  loader: LoaderType
  loaderVersion?: string
  minRam: number
  maxRam: number
  javaPath?: string
  customJvmArgs?: string
  createdAt: number
  lastPlayed?: number
}

// ─── Download Types ───────────────────────────────────────────────────────────
export interface DownloadProgress {
  name: string
  downloaded: number
  total: number
  percent: number
  speed: number
}

// ─── Mod Types ────────────────────────────────────────────────────────────────
export interface ModResult {
  id: string
  name: string
  description: string
  author: string
  downloads: number
  iconUrl?: string
  versions: string[]
  source: 'modrinth' | 'curseforge'
  projectId: string
}

export interface InstalledMod {
  id: string
  name: string
  filename: string
  instanceId: string
  source: 'modrinth' | 'curseforge'
  version: string
}

// ─── IPC Channels ─────────────────────────────────────────────────────────────
export type IpcChannel =
  | 'auth:microsoft-login'
  | 'auth:offline-login'
  | 'auth:logout'
  | 'auth:get-account'
  | 'versions:get-list'
  | 'versions:install'
  | 'instance:create'
  | 'instance:delete'
  | 'instance:get-all'
  | 'instance:launch'
  | 'mods:search'
  | 'mods:install'
  | 'mods:get-installed'
  | 'mods:remove'
  | 'download:progress'
  | 'game:launched'
  | 'game:closed'
  | 'settings:get'
  | 'settings:set'

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface LauncherSettings {
  closeOnLaunch: boolean
  discordRpc: boolean
  autoUpdate: boolean
  defaultMaxRam: number
  defaultMinRam: number
  javaPath: string
  gameDir: string
  sendCrashReports: boolean
  theme: 'dark'
}

export interface HudModuleConfig {
  id: string
  name: string
  enabled: boolean
  position?: { x: number; y: number }
}

// ─── Launch Result ────────────────────────────────────────────────────────────
export interface LaunchResult {
  success: boolean
  pid?: number
  error?: string
}

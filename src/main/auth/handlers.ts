import { IpcMain } from 'electron'
import axios from 'axios'
import { createHash } from 'crypto'
import * as http from 'http'
import * as url from 'url'
import { shell } from 'electron'

// Minecraft launcher client ID (public, official)
const MS_CLIENT_ID = '00000000402b5328'
const XBOX_URL  = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_URL  = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_URL    = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const PROF_URL  = 'https://api.minecraftservices.com/minecraft/profile'

// Device code flow - no redirect URI needed, works without VS or browser callback
async function getMSToken(): Promise<string> {
  // Step 1: get device code
  const dcRes = await axios.post(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      scope: 'XboxLive.SignIn XboxLive.offline_access'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  )
  const { device_code, user_code, verification_uri, expires_in, interval } = dcRes.data

  // Open browser for user
  shell.openExternal(`${verification_uri}?otc=${user_code}`)

  // Return device code info for UI to show
  return JSON.stringify({ device_code, user_code, verification_uri, expires_in, interval })
}

async function pollMSToken(device_code: string, interval: number): Promise<string> {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
  const deadline = Date.now() + 600_000 // 10 min max
  const pollMs = Math.max((interval || 5) * 1000, 5000)

  while (Date.now() < deadline) {
    await wait(pollMs)
    try {
      const res = await axios.post(
        'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        new URLSearchParams({
          grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
          client_id:   MS_CLIENT_ID,
          device_code
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
      )
      return res.data.access_token
    } catch (e: any) {
      const err = e.response?.data?.error
      if (err === 'authorization_pending') continue
      if (err === 'slow_down') { await wait(5000); continue }
      throw new Error(err || 'Auth failed')
    }
  }
  throw new Error('Login timed out')
}

async function xboxAuth(msToken: string): Promise<{ token: string; userHash: string }> {
  const xbl = await axios.post(XBOX_URL, {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msToken}` },
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT'
  }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 })

  const xsts = await axios.post(XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.data.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT'
  }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 })

  return { token: xsts.data.Token, userHash: xsts.data.DisplayClaims.xui[0].uhs }
}

async function mcAuth(xstsToken: string, userHash: string): Promise<string> {
  const res = await axios.post(MC_URL,
    { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  )
  return res.data.access_token
}

async function mcProfile(mcToken: string): Promise<{ uuid: string; username: string; skinUrl?: string }> {
  const res = await axios.get(PROF_URL, {
    headers: { Authorization: `Bearer ${mcToken}` }, timeout: 15000
  })
  const d = res.data
  // Get skin URL
  let skinUrl: string | undefined
  try {
    const texProp = d.properties?.find((p: any) => p.name === 'textures')
    if (texProp) {
      const texData = JSON.parse(Buffer.from(texProp.value, 'base64').toString())
      skinUrl = texData?.textures?.SKIN?.url
    }
  } catch {}
  return { uuid: d.id, username: d.name, skinUrl }
}

function genOfflineUUID(username: string): string {
  const hash = createHash('md5').update('OfflinePlayer:' + username).digest('hex')
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-3${hash.slice(13,16)}-${((parseInt(hash.slice(16,18),16)&0x3f)|0x80).toString(16)}${hash.slice(18,20)}-${hash.slice(20,32)}`
}

export function setupAuthHandlers(ipcMain: IpcMain, store: any) {
  // Start device code flow - returns info for UI
  ipcMain.handle('auth:microsoft-start', async () => {
    try {
      const info = await getMSToken()
      return { success: true, info: JSON.parse(info) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Poll for token completion
  ipcMain.handle('auth:microsoft-poll', async (_, { device_code, interval }: any) => {
    try {
      const msToken = await pollMSToken(device_code, interval)
      const { token: xstsToken, userHash } = await xboxAuth(msToken)
      const mcToken = await mcAuth(xstsToken, userHash)
      const profile = await mcProfile(mcToken)

      const account = {
        type: 'microsoft',
        username: profile.username,
        uuid: profile.uuid,
        accessToken: mcToken,
        skinUrl: profile.skinUrl,
        expiresAt: Date.now() + 86400000
      }
      store.set('account', account)
      return { success: true, account }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:offline-login', async (_, username: string) => {
    if (!username?.trim() || username.length < 3 || username.length > 16)
      return { success: false, error: 'Username: 3-16 characters, letters/numbers/underscore' }
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return { success: false, error: 'Only letters, numbers, underscore allowed' }

    const account = {
      type: 'offline',
      username: username.trim(),
      uuid: genOfflineUUID(username.trim()),
      accessToken: '0',
      skinUrl: null
    }
    store.set('account', account)
    return { success: true, account }
  })

  ipcMain.handle('auth:logout', async () => {
    store.delete('account')
    return { success: true }
  })

  ipcMain.handle('auth:get-account', async () => store.get('account', null))

  // Fetch skin head from Crafatar (no auth needed)
  ipcMain.handle('auth:get-skin-head', async (_, uuid: string) => {
    try {
      // Crafatar provides head renders
      const cleanUuid = uuid.replace(/-/g, '')
      return { success: true, url: `https://crafatar.com/avatars/${cleanUuid}?size=64&overlay=true` }
    } catch { return { success: false } }
  })
}

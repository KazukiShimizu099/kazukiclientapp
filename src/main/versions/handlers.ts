import { IpcMain, BrowserWindow } from 'electron'
import axios from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import http from 'http'
import https from 'https'

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
const RESOURCES_URL = 'https://resources.download.minecraft.net'

// Massive Performance Boost: Keep-Alive Connection Pooling
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 })
const client = axios.create({ httpAgent, httpsAgent })

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

function formatBytes(bytes: number) {
  if (!+bytes) return '0 MB'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function downloadFile(url: string, dest: string, win: BrowserWindow | null, label: string, maxRetries = 3): Promise<void> {
  await fs.ensureDir(path.dirname(dest))
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let start = 0
      if (await fs.pathExists(dest)) {
        start = (await fs.stat(dest)).size
      }

      if (start > 0) {
        try {
          const headRes = await client.head(url, { timeout: 10000 })
          const remoteSize = parseInt(headRes.headers['content-length'] || '0', 10)
          
          if (remoteSize > 0) {
            if (start === remoteSize) {
              // Silently skip if already downloaded to save IPC bridge spam
              return
            }
            if (start > remoteSize) {
              await fs.remove(dest)
              start = 0
            }
          }
        } catch (e) {}
      }

      const response = await client({
        method: 'GET', url, responseType: 'stream',
        headers: start > 0 ? { Range: `bytes=${start}-` } : {},
        timeout: 15000
      })

      if (start > 0 && response.status !== 206) {
        start = 0
        await fs.truncate(dest, 0)
      }

      const totalLength = parseInt(response.headers['content-length'] || '0', 10) + start
      let downloaded = start
      
      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(dest, { flags: start > 0 && response.status === 206 ? 'a' : 'w' })
        
        let stallTimer = setTimeout(() => {
          writer.destroy()
          reject(new Error('Stream stalled'))
        }, 10000)

        response.data.on('data', (chunk: Buffer) => {
          clearTimeout(stallTimer)
          stallTimer = setTimeout(() => {
            writer.destroy()
            reject(new Error('Stream stalled'))
          }, 10000)
          
          downloaded += chunk.length
          // Only send progress for large files (Client Core) to prevent UI lag
          if (label === 'Minecraft Core') {
            const percent = totalLength > 0 ? Math.round((downloaded / totalLength) * 100) : 0
            win?.webContents.send('download:progress', { name: label, percent, detail: `${formatBytes(downloaded)} / ${formatBytes(totalLength)}` })
          }
        })

        response.data.pipe(writer)
        
        writer.on('finish', () => { clearTimeout(stallTimer); resolve() })
        writer.on('error', (err) => { clearTimeout(stallTimer); writer.close(); reject(err) })
      })
      
      return
    } catch (err: any) {
      if (err.response && err.response.status === 416) await fs.remove(dest)
      if (attempt === maxRetries) throw new Error(`Failed: ${err.message}`)
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

async function downloadLibraries(libraries: any[], gameDir: string, win: BrowserWindow | null) {
  const validLibs = libraries.filter((lib: any) => {
    if (!lib.downloads?.artifact) return false
    if (lib.rules) {
      for (const rule of lib.rules) {
        if (rule.os) {
          if (rule.action==='allow' && rule.os?.name !== 'windows') return false
          if (rule.action==='disallow' && rule.os?.name === 'windows') return false
        }
      }
    }
    return true
  })
  
  let done = 0
  const total = validLibs.length
  const CONCURRENCY = 15 // Aggressive concurrent library downloads
  const queue = [...validLibs]

  async function worker() {
    while (queue.length > 0) {
      const lib = queue.pop()!
      const dest = path.join(gameDir, 'libraries', lib.downloads.artifact.path)
      try { await downloadFile(lib.downloads.artifact.url, dest, win, 'Library') } catch (e) {}
      done++
      if (done % 5 === 0 || done === total) {
        win?.webContents.send('download:progress', { name: 'Libraries', percent: Math.round((done/total)*100), detail: `${done} / ${total} files` })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

async function downloadAssets(assetIndex: any, assetIndexId: string, gameDir: string, win: BrowserWindow | null) {
  const assetIndexPath = path.join(gameDir, 'assets', 'indexes', `${assetIndexId}.json`)
  await downloadFile(assetIndex.url, assetIndexPath, win, 'Asset Index')
  
  const indexData = await fs.readJson(assetIndexPath)
  const objects = Object.values(indexData.objects) as Array<{ hash: string; size: number }>
  let done = 0
  const total = objects.length
  
  const CONCURRENCY = 40 // Extreme concurrency for small assets
  const queue = [...objects]
  
  async function worker() {
    while (queue.length > 0) {
      const obj = queue.pop()!
      const prefix = obj.hash.substring(0,2)
      const dest = path.join(gameDir, 'assets', 'objects', prefix, obj.hash)
      try { await downloadFile(`${RESOURCES_URL}/${prefix}/${obj.hash}`, dest, null, 'Asset') } catch (e) {}
      done++
      if (done % 100 === 0 || done === total) {
        win?.webContents.send('download:progress', { name: 'Game Assets', percent: Math.round((done/total)*100), detail: `${done} / ${total} files` })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

export function setupVersionHandlers(ipcMain: IpcMain, store: any) {
  ipcMain.handle('versions:get-list', async () => {
    try {
      const res = await client.get(MANIFEST_URL, { timeout: 10000 })
      const supported = res.data.versions.filter((v: any) => v.type === 'release')
      return { success: true, versions: supported }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('versions:install', async (event, versionId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const gameDir = getGameDir()
    try {
      win?.webContents.send('download:progress', { name:'Connecting...', percent: 5, detail: 'Mojang API' })
      const manifestRes = await client.get(MANIFEST_URL, { timeout: 10000 })
      const versionMeta = manifestRes.data.versions.find((v: any) => v.id === versionId)
      if (!versionMeta) throw new Error(`Version ${versionId} not found.`)

      win?.webContents.send('download:progress', { name:'Parsing version...', percent: 10, detail: '' })
      const versionRes = await client.get(versionMeta.url, { timeout: 10000 })
      const versionData = versionRes.data
      const actualId = versionData.id
      const versionDir = path.join(gameDir, 'versions', actualId)
      
      await fs.ensureDir(versionDir)
      await fs.writeJson(path.join(versionDir, `${actualId}.json`), versionData)

      win?.webContents.send('download:progress', { name:'Minecraft Core', percent: 0, detail: 'Starting download...' })
      const clientJarPath = path.join(versionDir, `${actualId}.jar`)
      await downloadFile(versionData.downloads.client.url, clientJarPath, win, 'Minecraft Core')

      await downloadLibraries(versionData.libraries, gameDir, win)
      await downloadAssets(versionData.assetIndex, versionData.assetIndex.id, gameDir, win)

      win?.webContents.send('download:progress', { name:'Extracting Natives', percent: 99, detail: 'Almost done' })
      const nativesDir = path.join(versionDir, 'natives')
      await fs.ensureDir(nativesDir)
      for (const lib of versionData.libraries) {
        if (lib.downloads?.classifiers) {
          const native = lib.downloads.classifiers['natives-windows'] || lib.downloads.classifiers['natives-windows-64']
          if (native) {
            const nativeJar = path.join(gameDir, 'libraries', native.path)
            if (await fs.pathExists(nativeJar)) {
              try {
                const zip = new AdmZip(nativeJar)
                zip.getEntries().forEach(entry => {
                  if (!entry.entryName.startsWith('META-INF') && entry.entryName.endsWith('.dll')) {
                    zip.extractEntryTo(entry, nativesDir, false, true)
                  }
                })
              } catch {}
            }
          }
        }
      }

      store.set(`installed.${versionId}`, { id:versionId, actualId, installedAt:Date.now() })
      win?.webContents.send('download:progress', { name:'Complete', percent: 100, detail: 'Ready' })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
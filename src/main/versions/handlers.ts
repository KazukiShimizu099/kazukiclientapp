import { IpcMain, BrowserWindow } from 'electron'
import axios from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
const RESOURCES_URL = 'https://resources.download.minecraft.net'

const VERSION_ID_MAP: Record<string, string> = {
  '26.1.1': '26.1.1',
  '26.1':   '26.1',
}

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  await fs.ensureDir(path.dirname(dest))
  if (await fs.pathExists(dest)) {
    const stat = await fs.stat(dest)
    if (stat.size > 0) return
  }
  const response = await axios({ method:'GET', url, responseType:'stream', timeout:60000 })
  const totalLength = parseInt(response.headers['content-length'] || '0', 10)
  let downloaded = 0
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(dest)
    response.data.on('data', (chunk: Buffer) => { downloaded += chunk.length; onProgress?.(downloaded, totalLength) })
    response.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
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
  for (let i = 0; i < validLibs.length; i++) {
    const lib = validLibs[i]
    const artifact = lib.downloads.artifact
    const dest = path.join(gameDir, 'libraries', artifact.path)
    win?.webContents.send('download:progress', {
      name: `Lib: ${lib.name.split(':')[1]}`, downloaded: i+1, total: validLibs.length,
      percent: Math.round(((i+1)/validLibs.length)*100)
    })
    try { await downloadFile(artifact.url, dest) } catch (e) { console.error(`Library failed: ${artifact.url}`) }
  }
}

async function downloadAssets(assetIndex: any, assetIndexId: string, gameDir: string, win: BrowserWindow | null) {
  const assetIndexPath = path.join(gameDir, 'assets', 'indexes', `${assetIndexId}.json`)
  await downloadFile(assetIndex.url, assetIndexPath)
  const indexData = await fs.readJson(assetIndexPath)
  const objects = Object.values(indexData.objects) as Array<{ hash: string; size: number }>
  let done = 0
  const total = objects.length
  const CONCURRENCY = 5 
  const queue = [...objects]
  async function worker() {
    while (queue.length > 0) {
      const obj = queue.pop()!
      const prefix = obj.hash.substring(0,2)
      const dest = path.join(gameDir, 'assets', 'objects', prefix, obj.hash)
      try { await downloadFile(`${RESOURCES_URL}/${prefix}/${obj.hash}`, dest) } catch (e) { console.error(`Asset failed: ${obj.hash}`) }
      done++
      if (done % 20 === 0) {
        win?.webContents.send('download:progress', {
          name:'Downloading Assets...', downloaded:done, total, percent:Math.round((done/total)*100)
        })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

export function setupVersionHandlers(ipcMain: IpcMain, store: any) {
  ipcMain.handle('versions:get-list', async () => {
    try {
      const res = await axios.get(MANIFEST_URL, { timeout: 15000 })
      const manifest = res.data
      const supported = manifest.versions.filter((v: any) => {
        if (v.type !== 'release') return false
        const id = v.id
        if (/^\d{2,}\./.test(id)) return true
        const [, minor] = id.split('.').map(Number)
        return minor >= 12
      })
      return { success: true, versions: supported, latest: manifest.latest.release }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('versions:install', async (event, versionId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const gameDir = getGameDir()
    try {
      win?.webContents.send('download:progress', { name:'Fetching manifest...', downloaded:0, total:1, percent:5 })
      const manifestRes = await axios.get(MANIFEST_URL, { timeout: 30000 })
      const lookupId = VERSION_ID_MAP[versionId] || versionId
      const versionMeta = manifestRes.data.versions.find((v: any) => v.id === lookupId || v.id === versionId)
      if (!versionMeta) throw new Error(`Version ${versionId} not found in manifest. Check connection.`)

      win?.webContents.send('download:progress', { name:'Downloading version data...', downloaded:0, total:1, percent:10 })
      const versionRes = await axios.get(versionMeta.url, { timeout: 30000 })
      const versionData = versionRes.data

      const actualId = versionData.id || versionId
      const versionDir = path.join(gameDir, 'versions', actualId)
      await fs.ensureDir(versionDir)
      await fs.writeJson(path.join(versionDir, `${actualId}.json`), versionData)

      if (versionId !== actualId) {
        store.set(`versionIdMap.${versionId}`, actualId)
      }

      win?.webContents.send('download:progress', { name:'Downloading client.jar...', downloaded:0, total:1, percent:15 })
      const clientJarPath = path.join(versionDir, `${actualId}.jar`)
      await downloadFile(versionData.downloads.client.url, clientJarPath)

      await downloadLibraries(versionData.libraries, gameDir, win)
      await downloadAssets(versionData.assetIndex, versionData.assetIndex.id, gameDir, win)

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
      win?.webContents.send('download:progress', { name:'Complete!', downloaded:1, total:1, percent:100 })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
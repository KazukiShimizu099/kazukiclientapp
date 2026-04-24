import { IpcMain } from 'electron'
import axios from 'axios'
import * as path from 'path'
import * as fs from 'fs-extra'
import { app } from 'electron'
import type { ModResult } from '../../shared/types'

const MODRINTH_API = 'https://api.modrinth.com/v2'
const CURSEFORGE_API = 'https://api.curseforge.com/v1'
// Users must add their own CurseForge key from console.curseforge.com
const CF_KEY = process.env.CURSEFORGE_API_KEY || 'YOUR_CURSEFORGE_KEY'

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

async function searchModrinth(query: string, mcVersion: string): Promise<ModResult[]> {
  const facets = [['project_type:mod']]
  if (mcVersion) facets.push([`versions:${mcVersion}`])

  const res = await axios.get(`${MODRINTH_API}/search`, {
    params: {
      query,
      facets: JSON.stringify(facets),
      limit: 20,
      index: 'downloads'
    }
  })

  return res.data.hits.map((hit: any): ModResult => ({
    id: hit.project_id,
    name: hit.title,
    description: hit.description,
    author: hit.author,
    downloads: hit.downloads,
    iconUrl: hit.icon_url,
    versions: hit.versions || [],
    source: 'modrinth',
    projectId: hit.project_id
  }))
}

async function searchCurseForge(query: string, mcVersion: string): Promise<ModResult[]> {
  if (CF_KEY === 'YOUR_CURSEFORGE_KEY') {
    return []
  }

  const res = await axios.get(`${CURSEFORGE_API}/mods/search`, {
    headers: { 'x-api-key': CF_KEY },
    params: {
      gameId: 432,
      searchFilter: query,
      gameVersion: mcVersion || undefined,
      classId: 6, // Mods
      sortField: 2, // Downloads
      pageSize: 20
    }
  })

  return res.data.data.map((mod: any): ModResult => ({
    id: String(mod.id),
    name: mod.name,
    description: mod.summary,
    author: mod.authors[0]?.name || 'Unknown',
    downloads: mod.downloadCount,
    iconUrl: mod.logo?.url,
    versions: [],
    source: 'curseforge',
    projectId: String(mod.id)
  }))
}

async function installModrinth(mod: ModResult, instanceId: string): Promise<void> {
  // Get latest version for the mod
  const versionsRes = await axios.get(`${MODRINTH_API}/project/${mod.projectId}/version`, {
    params: { loaders: '["fabric","forge"]' }
  })

  if (!versionsRes.data.length) throw new Error('No compatible versions found')

  const latestVersion = versionsRes.data[0]
  const file = latestVersion.files.find((f: any) => f.primary) || latestVersion.files[0]

  if (!file) throw new Error('No file found for this mod')

  const modsDir = path.join(getGameDir(), 'instances', instanceId, 'mods')
  await fs.ensureDir(modsDir)

  const dest = path.join(modsDir, file.filename)

  const response = await axios({
    method: 'GET',
    url: file.url,
    responseType: 'arraybuffer'
  })

  await fs.writeFile(dest, response.data)
}

export function setupModHandlers(ipcMain: IpcMain, store: any) {
  ipcMain.handle('mods:search', async (_, { query, source, mcVersion }: {
    query: string
    source: 'modrinth' | 'curseforge'
    mcVersion: string
  }) => {
    try {
      let results: ModResult[] = []

      if (source === 'modrinth') {
        results = await searchModrinth(query, mcVersion)
      } else {
        results = await searchCurseForge(query, mcVersion)
      }

      return { success: true, results }
    } catch (err: any) {
      return { success: false, error: err.message, results: [] }
    }
  })

  ipcMain.handle('mods:install', async (_, { mod, instanceId }: {
    mod: ModResult
    instanceId: string
  }) => {
    try {
      if (mod.source === 'modrinth') {
        await installModrinth(mod, instanceId)
      } else {
        throw new Error('CurseForge install requires API key - see README')
      }

      const installed = store.get(`mods.${instanceId}`, [])
      installed.push({
        id: mod.id,
        name: mod.name,
        filename: mod.name,
        instanceId,
        source: mod.source,
        version: 'latest'
      })
      store.set(`mods.${instanceId}`, installed)

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('mods:get-installed', async (_, instanceId: string) => {
    const installed = store.get(`mods.${instanceId}`, [])
    return { success: true, mods: installed }
  })

  ipcMain.handle('mods:remove', async (_, { modId, instanceId }: {
    modId: string
    instanceId: string
  }) => {
    try {
      const installed = store.get(`mods.${instanceId}`, [])
      const mod = installed.find((m: any) => m.id === modId)

      if (mod) {
        const modPath = path.join(getGameDir(), 'instances', instanceId, 'mods', mod.filename)
        await fs.remove(modPath)
      }

      store.set(`mods.${instanceId}`, installed.filter((m: any) => m.id !== modId))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

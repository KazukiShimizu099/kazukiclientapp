import { IpcMain } from 'electron'
import axios from 'axios'
import * as path from 'path'
import * as fs from 'fs-extra'
import { app } from 'electron'
import Store from 'electron-store'

const API_BASE = 'https://api.modrinth.com/v2'

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

export function setupModHandlers(ipcMain: IpcMain, store: Store) {
  ipcMain.handle('mods:search', async (_, { query, source, mcVersion, projectType, category, offset = 0 }) => {
    try {
      const loader = source.toLowerCase(); 
      const facets: string[][] = [
        [`versions:${mcVersion}`],
        [`project_type:${projectType}`]
      ];
      
      if (projectType === 'mod') facets.push([`categories:${loader}`]);
      if (category && category !== 'all') facets.push([`categories:${category}`]);
      
      const res = await axios.get(`${API_BASE}/search`, {
        params: {
          query: query || '',
          facets: JSON.stringify(facets),
          index: 'downloads',
          limit: 30,
          offset: offset // PAGINATION ADDED
        },
        timeout: 10000
      });
      
      return { success: true, results: res.data.hits, total: res.data.total_hits };
    } catch (error: any) {
      return { success: false, error: 'Failed to search Modrinth.' };
    }
  });

  ipcMain.handle('mods:install', async (_, { mod, instanceId }) => {
    try {
      const all: any[] = store.get('instances', []);
      const inst = all.find((i: any) => i.id === instanceId);
      if (!inst) throw new Error('Instance not found');

      const loaders = mod.project_type === 'mod' ? JSON.stringify([inst.loader]) : undefined;
      
      const verRes = await axios.get(`${API_BASE}/project/${mod.project_id}/version`, {
        params: { loaders: loaders, game_versions: JSON.stringify([inst.mcVersion]) },
        timeout: 10000
      });

      if (verRes.data.length === 0) throw new Error(`No compatible version found for ${inst.mcVersion}.`);
      
      const file = verRes.data[0].files.find((f: any) => f.primary) || verRes.data[0].files[0];
      
      let folderName = 'mods';
      if (mod.project_type === 'resourcepack') folderName = 'resourcepacks';
      if (mod.project_type === 'shader') folderName = 'shaderpacks';

      const targetDir = path.join(getGameDir(), 'instances', instanceId, folderName);
      await fs.ensureDir(targetDir);
      const dest = path.join(targetDir, file.filename);

      const response = await axios({ method: 'GET', url: file.url, responseType: 'stream' });
      const writer = fs.createWriteStream(dest);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      return { success: true, file: file.filename, folder: folderName };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mods:get-installed', async (_, instanceId) => {
    try {
      const instDir = path.join(getGameDir(), 'instances', instanceId);
      const folders = ['mods', 'resourcepacks', 'shaderpacks'];
      let items: any[] = [];

      for (const folder of folders) {
        const p = path.join(instDir, folder);
        if (await fs.pathExists(p)) {
          const files = await fs.readdir(p);
          const valid = files.filter(f => f.endsWith('.jar') || f.endsWith('.zip'));
          items.push(...valid.map(f => ({ id: f, filename: f, name: f.split('.')[0], folder })));
        }
      }
      return { success: true, mods: items };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mods:remove', async (_, { modId, instanceId, folder }) => {
    try {
      const targetFolder = folder || 'mods';
      const file = path.join(getGameDir(), 'instances', instanceId, targetFolder, modId);
      await fs.remove(file);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
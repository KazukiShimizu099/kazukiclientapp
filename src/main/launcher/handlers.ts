import { IpcMain, BrowserWindow, shell, app } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import AdmZip from 'adm-zip'
import type { Instance } from '../../shared/types'
import { setDiscordActivity } from '../discord/handlers'

const activeProcesses = new Map<string, any>()

app.on('before-quit', () => {
  for (const [id, child] of activeProcesses.entries()) {
    try { child.kill('SIGKILL') } catch (e) {}
  }
})

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

function getRequiredJavaVersion(mcVersion?: string): number {
  if (!mcVersion) return 21;
  if (/^26\./.test(mcVersion)) return 25; 
  if (/^\d{2}/.test(mcVersion)) return 21; 
  const parts = mcVersion.split('.');
  if (parts[0] === '1') {
    const minor = parseInt(parts[1] || '0');
    const patch = parseInt(parts[2] || '0');
    if (minor >= 21 || (minor === 20 && patch >= 5)) return 21;
    if (minor >= 17) return 17;
  }
  return 8;
}

async function ensureJavaRuntime(mcVersion: string, gameDir: string, win: BrowserWindow | null): Promise<string> {
  const javaVer = getRequiredJavaVersion(mcVersion);
  const runtimeDir = path.join(gameDir, 'runtime', `java-${javaVer}`);
  const findJavaw = async (dir: string): Promise<string | null> => {
    if (!await fs.pathExists(dir)) return null;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const res = await findJavaw(full);
        if (res) return res;
      } else if (e.name.toLowerCase() === 'javaw.exe') {
        return full;
      }
    }
    return null;
  };
  const existing = await findJavaw(runtimeDir);
  if (existing) return existing;
  win?.webContents.send('instance:log', `[System] Java ${javaVer} not found. Downloading...`);
  await fs.ensureDir(runtimeDir);
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${javaVer}/ga/windows/x64/jre/hotspot/normal/eclipse`;
  const zipPath = path.join(runtimeDir, 'temp.zip');
  const response = await axios({ method: 'GET', url: apiUrl, responseType: 'stream' });
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(runtimeDir, true);
  await fs.remove(zipPath);
  const extracted = await findJavaw(runtimeDir);
  if (!extracted) throw new Error('Java missing.');
  return extracted;
}

function buildJvmArgs(minRam:number, reqMaxRam:number, nativesDir:string, custom?:string, mcVersion?:string): string[] {
  const sysTotalRam = Math.floor(os.totalmem() / (1024 * 1024)); 
  const safeMaxRam = Math.max(1024, sysTotalRam - 2048); 
  const finalMaxRam = Math.min(reqMaxRam, safeMaxRam);
  const javaVer = getRequiredJavaVersion(mcVersion);
  const base = [
    `-Xms${Math.min(minRam, finalMaxRam)}M`, `-Xmx${finalMaxRam}M`,
    javaVer >= 21 ? '-XX:+UseZGC' : '-XX:+UseG1GC',
    `-Djava.library.path=${nativesDir}`,
    `-Dlog4j2.formatMsgNoLookups=true`
  ];
  if (custom?.trim()) base.push(...custom.split(' ').filter(Boolean));
  return base;
}

function parseMaven(name: string, baseUrl: string = 'https://maven.fabricmc.net/') {
  const p = name.split(':');
  const g = p[0].replace(/\./g, '/');
  return { url: `${baseUrl}${g}/${p[1]}/${p[2]}/${p[1]}-${p[2]}.jar`, path: `${g}/${p[1]}/${p[2]}/${p[1]}-${p[2]}.jar` };
}

async function autoOptimizeInstance(instId: string, mcVersion: string, loader: string, win: BrowserWindow | null) {
  if (loader !== 'fabric') return;
  const modsDir = path.join(getGameDir(), 'instances', instId, 'mods');
  const mods = [{ slug: 'sodium' }, { slug: 'lithium' }, { slug: 'ferrite-core' }];
  const modSourcePath = path.join(app.getAppPath(), 'resources', 'kazuki-core.jar');
  const modDestPath = path.join(modsDir, 'kazuki-core.jar');
if (await fs.pathExists(modSourcePath)) {
  await fs.copy(modSourcePath, modDestPath);
}
  for (const mod of mods) {
    try {
      const res = await axios.get(`https://api.modrinth.com/v2/project/${mod.slug}/version`, { params: { loaders: JSON.stringify([loader]), game_versions: JSON.stringify([mcVersion]) } });
      if (res.data[0]) {
        const file = res.data[0].files[0];
        const dest = path.join(modsDir, file.filename);
        if (!await fs.pathExists(dest)) {
          win?.webContents.send('instance:log', `[Optimizer] Injecting ${mod.slug}...`);
          const fRes = await axios({ url: file.url, responseType: 'stream' });
          fRes.data.pipe(fs.createWriteStream(dest));
        }
      }
    } catch (e) {}
  }
}

export function setupInstanceHandlers(ipcMain: IpcMain, store: any, _win: BrowserWindow | null) {
  ipcMain.handle('instance:create', async (_, data: any) => {
    const inst: Instance = { ...data, id: uuidv4(), createdAt: Date.now() };
    const instances: Instance[] = store.get('instances', []);
    instances.push(inst);
    store.set('instances', instances);
    await fs.ensureDir(path.join(getGameDir(), 'instances', inst.id, 'mods'));
    return { success: true, instance: inst };
  });

  ipcMain.handle('instance:get-all', async () => {
    return { success: true, instances: store.get('instances', []) };
  });

  ipcMain.handle('instance:delete', async (_, id: string) => {
    try {
      const all: Instance[] = store.get('instances', []);
      store.set('instances', all.filter((i: any) => i.id !== id));
      await fs.remove(path.join(getGameDir(), 'instances', id));
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('instance:open-folder', async (_, instanceId: string) => {
    try {
      const dir = path.join(getGameDir(), 'instances', instanceId);
      await fs.ensureDir(dir);
      await shell.openPath(dir);
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('instance:update', async (_, { id, data }) => {
    try {
      const all: Instance[] = store.get('instances', []);
      const idx = all.findIndex((i: any) => i.id === id);
      if (idx === -1) throw new Error('Instance not found');
      
      all[idx] = { ...all[idx], ...data };
      store.set('instances', all);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('instance:kill', async (_, instanceId: string) => {
    const child = activeProcesses.get(instanceId);
    if (child) {
      try {
        child.kill('SIGKILL');
        activeProcesses.delete(instanceId);
        return { success: true };
      } catch (e: any) { return { success: false, error: e.message }; }
    }
    return { success: false, error: 'Process not running' };
  });

  ipcMain.handle('instance:launch', async (event, instanceId: string) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const inst = (store.get('instances', []) as Instance[]).find(i => i.id === instanceId);
      if (!inst) throw new Error('Not found');

      const gameDir = getGameDir();
      const actualId = (store.get(`installed.${inst.mcVersion}`)?.actualId) || inst.mcVersion;
      const instDir = path.join(gameDir, 'instances', instanceId);
      
      await autoOptimizeInstance(instanceId, actualId, inst.loader, win);

      const vd = await fs.readJson(path.join(gameDir, 'versions', actualId, `${actualId}.json`));
      const libs: any[] = [...vd.libraries];
      let mainClass = vd.mainClass;

      if (inst.loader === 'fabric') {
        const meta = (await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${inst.mcVersion}`)).data[0];
        const fp = (await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${inst.mcVersion}/${meta.loader.version}/profile/json`)).data;
        mainClass = fp.mainClass;
        for (const lib of fp.libraries) {
          const m = parseMaven(lib.name, lib.url);
          const dest = path.join(gameDir, 'libraries', m.path);
          libs.push({ downloads: { artifact: { path: m.path } } });
          if (!await fs.pathExists(dest)) {
            await fs.ensureDir(path.dirname(dest));
            const r = await axios({ url: m.url, responseType: 'stream' });
            r.data.pipe(fs.createWriteStream(dest));
          }
        }
      }

      const cp = libs.filter(l => l.downloads?.artifact).map(l => path.join(gameDir, 'libraries', l.downloads.artifact.path)).concat(path.join(gameDir, 'versions', actualId, `${actualId}.jar`)).join(path.delimiter);
      const java = await ensureJavaRuntime(actualId, gameDir, win);
      
      // Kazuki Branding Injection in JVM args
      const args = [
        ...buildJvmArgs(inst.minRam || 512, inst.maxRam || 2048, path.join(gameDir, 'versions', actualId, 'natives'), inst.customJvmArgs, inst.mcVersion), 
        '-cp', cp, 
        mainClass,
        '--versionType', 'Kazuki Client'
      ];
      
      // Inject config for future Java Mod
      const configDir = path.join(instDir, 'config');
      await fs.ensureDir(configDir);
      await fs.writeJson(path.join(configDir, 'kazuki-client.json'), {
        windowTitle: `Kazuki Client ${inst.mcVersion}`,
        hudEnabled: true
      }, { spaces: 2 });

      const env = Object.assign({}, process.env);
      delete env._JAVA_OPTIONS; delete env.JAVA_TOOL_OPTIONS;
      
      const child = spawn(java, args, { cwd: instDir, stdio: ['ignore', 'pipe', 'pipe'], env });
      activeProcesses.set(instanceId, child);
      
      // Force Discord RPC High Priority on Launch
      setDiscordActivity(`Playing ${inst.name}`, `Minecraft ${inst.mcVersion}`, true);
      
      child.stdout?.on('data', (d) => win?.webContents.send('instance:log', `[Game] ${d}`));
      child.stderr?.on('data', (d) => win?.webContents.send('instance:log', `[JVM] ${d}`));
      
      child.on('exit', () => {
        activeProcesses.delete(instanceId);
        win?.webContents.send('instance:stopped', instanceId);
        // Revert Discord RPC when closed
        setDiscordActivity('In Launcher', 'Browsing Instances', false);
      });
      
      return { success: true };
    } catch (e: any) { 
      return { success: false, error: e.message }; 
    }
  });
}
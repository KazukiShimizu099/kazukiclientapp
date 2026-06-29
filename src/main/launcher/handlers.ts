import { IpcMain, BrowserWindow, shell, app } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import AdmZip from 'adm-zip'
import type { Instance, LauncherSettings } from '../../shared/types'

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
  if (existing) {
    win?.webContents.send('instance:log', `[System] Using isolated Java ${javaVer} (x64) environment.`);
    return existing;
  }

  win?.webContents.send('instance:log', `[System] Java ${javaVer} not found. Preparing automatic download...`);
  await fs.ensureDir(runtimeDir);
  
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${javaVer}/ga/windows/x64/jre/hotspot/normal/eclipse`;
  const zipPath = path.join(runtimeDir, 'temp.zip');
  
  try {
    win?.webContents.send('instance:log', `[System] Downloading Java Runtime Environment...`);
    const response = await axios({ method: 'GET', url: apiUrl, responseType: 'stream' });
    
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    win?.webContents.send('instance:log', `[System] Extracting Java architecture...`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(runtimeDir, true);
    await fs.remove(zipPath);

    const extracted = await findJavaw(runtimeDir);
    if (!extracted) throw new Error(`Java binary missing.`);
    return extracted;
  } catch (error: any) {
    throw new Error(`Failed to provision Java ${javaVer}. Detail: ${error.message}`);
  }
}

function buildJvmArgs(minRam:number, reqMaxRam:number, nativesDir:string, custom?:string, mcVersion?:string): string[] {
  const sysTotalRam = Math.floor(os.totalmem() / (1024 * 1024)); 
  const osReserved = 2048; 
  const safeMaxRam = Math.max(1024, sysTotalRam - osReserved); 
  const finalMaxRam = Math.min(reqMaxRam, safeMaxRam);
  const safeMin = Math.min(Math.max(minRam, 256), finalMaxRam);
  
  const javaVer = getRequiredJavaVersion(mcVersion);
  const useZGC = javaVer >= 21;

  const base = [
    `-Xms${safeMin}M`, `-Xmx${finalMaxRam}M`,
    useZGC ? '-XX:+UseZGC' : '-XX:+UseG1GC',
    `-XX:+UnlockExperimentalVMOptions`,
    `-XX:MaxGCPauseMillis=200`,
    `-XX:+ParallelRefProcEnabled`,
    `-XX:+DisableExplicitGC`,
    `-XX:SurvivorRatio=32`,
    `-XX:+PerfDisableSharedMem`,
    `-XX:MaxTenuringThreshold=1`,
    `-Dlog4j2.formatMsgNoLookups=true`,
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=KazukiClient`,
    `-Dminecraft.launcher.version=1.0.0`,
    `-Dfml.ignoreInvalidMinecraftCertificates=true`,
    `-Dfml.ignorePatchDiscrepancies=true`,
  ]
  if (custom?.trim()) base.push(...custom.split(' ').filter(Boolean))
  return base
}

function buildClasspath(libraries:any[], gameDir:string, versionId:string): string {
  const paths: string[] = []
  for (const lib of libraries) {
    if (!lib.downloads?.artifact) continue
    if (lib.rules) {
      let ok = false
      for (const r of lib.rules) {
        if (r.action==='allow' && (!r.os || r.os.name==='windows')) ok=true
        if (r.action==='disallow' && r.os?.name==='windows') { ok=false; break }
      }
      if (!ok) continue
    }
    const p = path.join(gameDir, 'libraries', lib.downloads.artifact.path)
    if (fs.existsSync(p)) paths.push(p)
  }
  const jar = path.join(gameDir,'versions',versionId,`${versionId}.jar`)
  if (fs.existsSync(jar)) paths.push(jar)
  return paths.join(path.delimiter)
}

function resolveArgs(args:string[], rep:Record<string,string>): string[] {
  return args.map(a => {
    let r = a
    for (const [k,v] of Object.entries(rep)) { r = r.replace(new RegExp(`\\$\\{${k}\\}`,'g'), v) }
    return r
  })
}

// Fabric Maven Parser Helper
function parseMaven(name: string, baseUrl: string = 'https://maven.fabricmc.net/') {
  const p = name.split(':');
  const g = p[0].replace(/\./g, '/');
  const file = `${p[1]}-${p[2]}.jar`;
  return { url: `${baseUrl}${g}/${p[1]}/${p[2]}/${file}`, path: `${g}/${p[1]}/${p[2]}/${file}` };
}

export function setupInstanceHandlers(ipcMain:IpcMain, store:any, _win:BrowserWindow|null) {
  ipcMain.handle('instance:create', async (_,data:any)=>{
    try {
      const inst:Instance = {...data, id:uuidv4(), createdAt:Date.now()}
      const instances:Instance[] = store.get('instances',[])
      instances.push(inst)
      store.set('instances',instances)
      const dir = path.join(getGameDir(),'instances',inst.id)
      await Promise.all([
        fs.ensureDir(path.join(dir,'mods')),
        fs.ensureDir(path.join(dir,'resourcepacks')),
        fs.ensureDir(path.join(dir,'saves')),
        fs.ensureDir(path.join(dir,'config')),
        fs.ensureDir(path.join(dir,'logs'))
      ])
      return {success:true,instance:inst}
    } catch(e:any){return{success:false,error:e.message}}
  })

  ipcMain.handle('instance:get-all',async()=>({success:true,instances:store.get('instances',[])}))
  
  ipcMain.handle('instance:delete',async(_,id:string)=>{
    try{
      const all:Instance[]=store.get('instances',[])
      store.set('instances',all.filter((i:any)=>i.id!==id))
      await fs.remove(path.join(getGameDir(),'instances',id))
      return{success:true}
    }catch(e:any){return{success:false,error:e.message}}
  })

  ipcMain.handle('instance:open-folder', async (_, instanceId: string) => {
    try {
      const dir = path.join(getGameDir(), 'instances', instanceId);
      await fs.ensureDir(dir);
      await shell.openPath(dir);
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('instance:launch',async(event,instanceId:string)=>{
    try{
      const win = BrowserWindow.fromWebContents(event.sender)
      const all:Instance[]=store.get('instances',[])
      const inst=all.find((i:any)=>i.id===instanceId)
      if(!inst) throw new Error('Instance not found')

      const account=store.get('account')
      if(!account) throw new Error('Not logged in.')

      const settings:LauncherSettings=store.get('settings',{})
      const gameDir=getGameDir()

      const meta=store.get(`installed.${inst.mcVersion}`)
      const actualId=meta?.actualId||inst.mcVersion

      const versionDir=path.join(gameDir,'versions',actualId)
      const versionJson=path.join(versionDir,`${actualId}.json`)
      if(!await fs.pathExists(versionJson)) throw new Error(`Core files missing. Recreate instance.`)

      const vd=await fs.readJson(versionJson)
      const nativesDir=path.join(versionDir,'natives')
      const instDir=path.join(gameDir,'instances',instanceId)

      await fs.ensureDir(instDir)
      await fs.ensureDir(nativesDir)

      let mainClass = vd.mainClass;
      let gameArgsRaw: string[] = [];
      if (vd.arguments?.game) gameArgsRaw.push(...vd.arguments.game.filter((a:any)=>typeof a==='string'));
      else if (vd.minecraftArguments) gameArgsRaw.push(...vd.minecraftArguments.split(' '));

      const allLibs = [...vd.libraries];

      // THE CORE FIX: DYNAMIC FABRIC INJECTION
      if (inst.loader === 'fabric') {
        win?.webContents.send('instance:log', '[System] Checking Fabric Loader requirements...');
        const metaRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${inst.mcVersion}`);
        if (!metaRes.data || metaRes.data.length === 0) throw new Error(`Fabric is not available for ${inst.mcVersion}`);
        
        const loaderVer = metaRes.data[0].loader.version;
        win?.webContents.send('instance:log', `[System] Injecting Fabric ${loaderVer}...`);
        
        const profileRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${inst.mcVersion}/${loaderVer}/profile/json`);
        const fp = profileRes.data;

        mainClass = fp.mainClass; // Overrides Vanilla Main with KnotClient
        if (fp.arguments?.game) gameArgsRaw.push(...fp.arguments.game);
        
        for (const lib of fp.libraries) {
          const maven = parseMaven(lib.name, lib.url);
          const dest = path.join(gameDir, 'libraries', maven.path);
          
          allLibs.push({ downloads: { artifact: { path: maven.path } } });

          if (!await fs.pathExists(dest)) {
            await fs.ensureDir(path.dirname(dest));
            try {
              const res = await axios({ method:'GET', url:maven.url, responseType:'stream' });
              const writer = fs.createWriteStream(dest);
              res.data.pipe(writer);
              await new Promise((res,rej) => { writer.on('finish',res); writer.on('error',rej); });
            } catch(e) { throw new Error(`Failed to download Fabric dependency: ${lib.name}`); }
          }
        }
      }

      const classpath=buildClasspath(allLibs, gameDir, actualId)
      if(!classpath.trim()) throw new Error('Libraries missing.')

      const javaPath = await ensureJavaRuntime(actualId, gameDir, win)
      const jvmArgs=buildJvmArgs(inst.minRam||512,inst.maxRam||2048,nativesDir,(inst as any).customJvmArgs,inst.mcVersion)
      
      const uuid=(account.uuid||'').replace(/-/g,'')||'0'.repeat(32)
      const rep:Record<string,string>={
        auth_player_name:  account.username,
        version_name:      actualId,
        game_directory:    instDir,
        assets_root:       path.join(gameDir,'assets'),
        assets_index_name: vd.assetIndex?.id||actualId,
        auth_uuid:         uuid,
        auth_access_token: account.accessToken||'0',
        clientid:          '0',
        auth_xuid:         '0',
        user_type:         account.type==='microsoft'?'msa':'legacy',
        version_type:      vd.type||'release',
        resolution_width:  '1280',
        resolution_height: '720',
        classpath,
      }

      const gameArgs=resolveArgs(gameArgsRaw,rep)
      const fullArgs=[...jvmArgs,'-cp',classpath,mainClass,...gameArgs]

      const cleanEnv = Object.assign({}, process.env)
      delete cleanEnv._JAVA_OPTIONS
      delete cleanEnv.JAVA_TOOL_OPTIONS
      delete cleanEnv.JAVA_HOME
      delete cleanEnv.JRE_HOME

      const safeArgs = fullArgs.map(arg => arg.replace(/NaN/g, '2048'))

      const child=spawn(javaPath,safeArgs,{ cwd:instDir, stdio: ['ignore', 'pipe', 'pipe'], env: cleanEnv })
      activeProcesses.set(instanceId, child)

      child.stdout?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) win?.webContents.send('instance:log', `[Game] ${msg}`)
      })

      child.stderr?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) win?.webContents.send('instance:log', `[JVM ERROR] ${msg}`)
      })

      child.on('exit', (code) => {
        activeProcesses.delete(instanceId)
        if (win && !win.isDestroyed()) {
          win.webContents.send('instance:log', `[System] Process exited with code ${code}`)
          win.webContents.send('instance:exit', { instanceId, code })
        }
      })

      const idx=all.findIndex((i:any)=>i.id===instanceId)
      if(idx!==-1){ all[idx].lastPlayed=Date.now(); store.set('instances',all) }
      if((settings as any).minimizeOnGame) win?.minimize()

      return{success:true,pid:child.pid}
    }catch(e:any){ return{success:false,error:e.message} }
  })
}
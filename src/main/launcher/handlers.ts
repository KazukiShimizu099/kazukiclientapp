import { IpcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs-extra'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import AdmZip from 'adm-zip'
import type { Instance, LauncherSettings } from '../../shared/types'

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

function getRequiredJavaVersion(mcVersion?: string): number {
  if (!mcVersion) return 17;
  const parts = mcVersion.split('.');
  const minor = parseInt(parts[1] || '0');
  const patch = parseInt(parts[2] || '0');

  if (minor >= 21 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 17) return 17;
  return 8;
}

async function ensureJavaRuntime(mcVersion: string, gameDir: string): Promise<string> {
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

  await fs.ensureDir(runtimeDir);
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${javaVer}/ga/windows/x64/jre/hotspot/normal/eclipse`;
  const zipPath = path.join(runtimeDir, 'temp.zip');
  
  try {
    const response = await axios({
      method: 'GET',
      url: apiUrl,
      responseType: 'arraybuffer'
    });
    
    await fs.writeFile(zipPath, response.data);
    
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(runtimeDir, true);
    await fs.remove(zipPath);

    const extracted = await findJavaw(runtimeDir);
    if (!extracted) throw new Error(`Java ${javaVer} binary missing after extraction.`);
    return extracted;
  } catch (error: any) {
    throw new Error(`Failed to download Java ${javaVer}. Check your internet connection. Detail: ${error.message}`);
  }
}

function buildJvmArgs(minRam:number, maxRam:number, nativesDir:string, custom?:string, mcVersion?:string): string[] {
  const safeMax = Math.min(Math.max(maxRam,1024),12288)
  const safeMin = Math.min(Math.max(minRam,256),safeMax)
  const isNewVersion = mcVersion && /^\d{2}\./.test(mcVersion)

  const base = [
    `-Xms${safeMin}M`, `-Xmx${safeMax}M`,
    isNewVersion ? '-XX:+UseZGC' : '-XX:+UseG1GC',
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
    for (const [k,v] of Object.entries(rep)) {
      r = r.replace(new RegExp(`\\$\\{${k}\\}`,'g'), v)
    }
    return r
  })
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
        fs.ensureDir(path.join(dir,'logs')),
        fs.ensureDir(path.join(dir,'crash-reports')),
        fs.ensureDir(path.join(dir,'screenshots')),
        fs.ensureDir(path.join(dir,'shaderpacks')),
      ])
      const optFile = path.join(dir,'options.txt')
      if (!await fs.pathExists(optFile)) {
        await fs.writeFile(optFile,'version:3\nautoJump:false\nrenderDistance:8\nmaxFps:260\nfboEnable:true\nlang:en_us\n')
      }
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

  ipcMain.handle('instance:launch',async(event,instanceId:string)=>{
    try{
      const all:Instance[]=store.get('instances',[])
      const inst=all.find((i:any)=>i.id===instanceId)
      if(!inst) throw new Error('Instance not found')

      const account=store.get('account')
      if(!account) throw new Error('Not logged in. Click your avatar to sign in.')

      const settings:LauncherSettings=store.get('settings',{})
      const gameDir=getGameDir()

      const meta=store.get(`installed.${inst.mcVersion}`)
      const actualId=meta?.actualId||inst.mcVersion

      const versionDir=path.join(gameDir,'versions',actualId)
      const versionJson=path.join(versionDir,`${actualId}.json`)
      if(!await fs.pathExists(versionJson)){
        throw new Error(`Minecraft ${inst.mcVersion} not installed. Delete this instance and create a new one.`)
      }

      const vd=await fs.readJson(versionJson)
      const nativesDir=path.join(versionDir,'natives')
      const instDir=path.join(gameDir,'instances',instanceId)

      await fs.ensureDir(instDir)
      await fs.ensureDir(nativesDir)
      await fs.ensureDir(path.join(instDir,'logs'))

      const classpath=buildClasspath(vd.libraries,gameDir,actualId)
      if(!classpath.trim()) throw new Error('Libraries missing. Reinstall instance with active internet connection.')

      const javaPath = await ensureJavaRuntime(actualId, gameDir)
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

      const rawArgs:string[]=[]
      if(vd.arguments?.game){
        for(const a of vd.arguments.game){ if(typeof a==='string') rawArgs.push(a) }
      } else if(vd.minecraftArguments){
        rawArgs.push(...vd.minecraftArguments.split(' '))
      }

      const gameArgs=resolveArgs(rawArgs,rep)
      const fullArgs=[...jvmArgs,'-cp',classpath,vd.mainClass,...gameArgs]

      const win=BrowserWindow.fromWebContents(event.sender)
      
      const child=spawn(javaPath,fullArgs,{cwd:instDir,detached:true,stdio:'ignore'})
      child.unref()

      const idx=all.findIndex((i:any)=>i.id===instanceId)
      if(idx!==-1){ all[idx].lastPlayed=Date.now(); store.set('instances',all) }

      if((settings as any).minimizeOnGame) win?.minimize()

      return{success:true,pid:child.pid}
    }catch(e:any){
      return{success:false,error:e.message}
    }
  })
}
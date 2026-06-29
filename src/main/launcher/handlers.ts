import { IpcMain, BrowserWindow } from 'electron'
import { spawn, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs-extra'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { Instance, LauncherSettings } from '../../shared/types'

function getGameDir(): string {
  return path.join(app.getPath('appData'), '.kazuki')
}

function buildJvmArgs(minRam:number, maxRam:number, nativesDir:string, custom?:string, mcVersion?:string): string[] {
  const safeMax = Math.min(Math.max(maxRam,1024),12288)
  const safeMin = Math.min(Math.max(minRam,256),safeMax)

  // 26.x needs ZGC (Java 25+), older versions use G1GC
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

async function findJava(custom?:string, mcVersion?:string): Promise<string> {
  if (custom?.trim() && await fs.pathExists(custom.trim())) return custom.trim()

  try {
    const out = execSync('where javaw', {encoding:'utf8',timeout:3000}).trim()
    const first = out.split('\n')[0].trim()
    if (first && await fs.pathExists(first)) return first
  } catch {}

  if (process.env.JAVA_HOME) {
    const j = path.join(process.env.JAVA_HOME,'bin','javaw.exe')
    if (await fs.pathExists(j)) return j
  }

  const pf = process.env['ProgramFiles'] || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const vendors = ['Java','Eclipse Adoptium','Microsoft','Temurin','Zulu','BellSoft','Amazon Corretto','GraalVM','OpenJDK','Semeru']
  
  for (const base of [pf,pf86]) {
    for (const v of vendors) {
      const dir = path.join(base,v)
      if (!await fs.pathExists(dir)) continue
      try {
        const entries = (await fs.readdir(dir)).sort().reverse()
        for (const e of entries) {
          const j1 = path.join(dir,e,'bin','javaw.exe')
          if (await fs.pathExists(j1)) return j1
          const j2 = path.join(dir,e,'jre','bin','javaw.exe')
          if (await fs.pathExists(j2)) return j2
        }
      } catch {}
    }
  }

  try {
    const reg = execSync('reg query "HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit" /v CurrentVersion',{encoding:'utf8',timeout:3000})
    const vm = reg.match(/CurrentVersion\s+REG_SZ\s+(.+)/)
    if (vm) {
      const home = execSync(`reg query "HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\${vm[1].trim()}" /v JavaHome`,{encoding:'utf8',timeout:3000})
      const hm = home.match(/JavaHome\s+REG_SZ\s+(.+)/)
      if (hm) {
        const j = path.join(hm[1].trim(),'bin','javaw.exe')
        if (await fs.pathExists(j)) return j
      }
    }
  } catch {}

  // SILENT FAIL KO HATA DIYA HAI. EXPLICIT ERROR THROW KAREGA.
  throw new Error('Java not found on your system. Please install Java 17/21 from Adoptium or specify the exact java path in Settings.');
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
      if(!account) throw new Error('Not logged in — click your avatar to sign in')

      const settings:LauncherSettings=store.get('settings',{})
      const gameDir=getGameDir()

      const meta=store.get(`installed.${inst.mcVersion}`)
      const actualId=meta?.actualId||inst.mcVersion

      const versionDir=path.join(gameDir,'versions',actualId)
      const versionJson=path.join(versionDir,`${actualId}.json`)
      if(!await fs.pathExists(versionJson)){
        throw new Error(`Minecraft ${inst.mcVersion} not installed.\nDelete this instance and create a new one with "Install & Create".`)
      }

      const vd=await fs.readJson(versionJson)
      const nativesDir=path.join(versionDir,'natives')
      const instDir=path.join(gameDir,'instances',instanceId)

      await fs.ensureDir(instDir)
      await fs.ensureDir(nativesDir)
      await fs.ensureDir(path.join(instDir,'logs'))

      const classpath=buildClasspath(vd.libraries,gameDir,actualId)
      if(!classpath.trim()) throw new Error('Libraries missing — delete instance and reinstall with internet connection.')

      // ERROR PROPAGATION: Agar findJava fail hua, catch block direct error ko UI par bhej dega
      const javaPath=await findJava((inst as any).javaPath||(settings as any).javaPath, inst.mcVersion)
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
      
      // Detached execute hoga, agar crash hua toh logs `.kazuki/instances/id/logs` me jayenge
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
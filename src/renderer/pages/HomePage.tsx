import { useState, useEffect, useRef } from 'react'
import type { Account, Instance } from '../types'
import CreateInstanceModal from '../components/CreateInstanceModal'
import s from './HomePage.module.css'

interface Props { account: Account | null }

const LC: Record<string,string> = { fabric:'#00d4ff', forge:'#f5c842', vanilla:'#a78bfa', optifine:'#f97316' }

export default function HomePage({ account }: Props) {
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [launchState, setLaunchState] = useState<'idle'|'loading'|'launching'|'running'|'error'>('idle')
  const [launchError, setLaunchError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null)
  const [playTime, setPlayTime] = useState(0) // seconds
  const [console_, setConsole] = useState<string[]>([])
  const [showConsole, setShowConsole] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    loadInstances()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function loadInstances() {
    const r = await window.kazuki?.instance.getAll()
    if (r?.success) {
      setInstances(r.instances)
      if (r.instances.length > 0) setSelectedId(r.instances[0].id)
    }
  }

  const selected = instances.find(i => i.id === selectedId) || instances[0] || null

  function addLog(msg: string) {
    setConsole(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  async function handleLaunch() {
    if (!account) { setLaunchError('Login required'); return }
    if (!selected) { setLaunchError('Create an instance first'); return }
    setLaunchState('loading'); setLaunchError(''); setPlayTime(0)
    addLog(`Launching ${selected.name} (${selected.mcVersion} ${selected.loader})...`)
    addLog(`Java path: auto-detect`)
    addLog(`RAM: ${Math.round((selected.maxRam||2048)/1024)}G max`)
    
    await new Promise(r => setTimeout(r, 800))
    setLaunchState('launching')
    
    const r = await window.kazuki?.instance.launch(selected.id)
    if (r?.success) {
      setLaunchState('running')
      addLog(`Game launched successfully (PID: ${r.pid})`)
      
      // SYNTAX ERROR FIXED HERE: set-state to setState
      window.kazuki?.discord.setState?.({
        details: `Playing ${selected.mcVersion}`,
        state: `${selected.name} — Kazuki Client`
      })
      
      timerRef.current = setInterval(() => setPlayTime(p => p + 1), 1000)
    } else {
      setLaunchError(r?.error || 'Launch failed')
      setLaunchState('error')
      addLog(`ERROR: ${r?.error || 'Launch failed'}`)
      if (r?.error?.includes('ENOENT') || r?.error?.includes('javaw')) {
        addLog('FIX: Install Java 17/21 from adoptium.net then set path in Settings')
      }
      if (r?.error?.includes('not installed')) {
        addLog('FIX: Delete this instance and create a new one with "Install & Create"')
      }
      setTimeout(() => { setLaunchState('idle'); setLaunchError('') }, 7000)
    }
  }

  function stopGame() {
    if (timerRef.current) clearInterval(timerRef.current)
    setLaunchState('idle')
    setPlayTime(0)
    window.kazuki?.discord.setState?.({ details:'Kazuki Client v1.0', state:'In Launcher' })
    addLog('Game session ended')
  }

  function formatTime(s: number): string {
    const h = Math.floor(s/3600)
    const m = Math.floor((s%3600)/60)
    const sec = s%60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  async function handleDelete(id: string) {
    const r = await window.kazuki?.instance.delete(id)
    if (r?.success) {
      const next = instances.filter(i => i.id !== id)
      setInstances(next)
      if (selectedId === id) setSelectedId(next[0]?.id || null)
    }
    setConfirmDelete(null)
  }

  function handleCreated(inst: any) {
    setInstances(prev => [...prev, inst])
    setSelectedId(inst.id)
    addLog(`Instance created: ${inst.name} (${inst.mcVersion})`)
  }

  const icolor = (selected as any)?.iconColor || '#4ade80'
  const itext  = (selected as any)?.iconText  || selected?.name?.substring(0,2).toUpperCase() || 'KZ'
  const lbl = { idle:'LAUNCH', loading:'LOADING', launching:'LAUNCHING', running:'RUNNING', error:'ERROR' }[launchState]

  return (
    <div className={s.page}>
      <div className={s.hero}>
        <div className={s.heroBg}/>
        
        <div className={s.heroContent}>
          <div className={s.eyebrow}>Kazuki Client</div>
          <div className={s.titleRow}>
            <img src="logo32.png" className={s.titleLeaf} alt=""
              onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
            <span className={s.titleK}>KA</span><span className={s.titleRest}>ZUKI</span>
          </div>
          {selected && (
            <div className={s.chips}>
              <span className={s.chip} style={{color:'#4ade80',borderColor:'rgba(74,222,128,.25)'}}>
                Java {selected.mcVersion}
              </span>
              <span className={s.chip} style={{color:LC[selected.loader]||'#a78bfa',borderColor:(LC[selected.loader]||'#a78bfa')+'44'}}>
                {selected.loader.toUpperCase()}
              </span>
              <span className={s.chip} style={{color:'#5a4e80',borderColor:'rgba(90,78,128,.2)'}}>
                {Math.round((selected.maxRam||2048)/1024)}G RAM
              </span>
              {launchState==='running' && (
                <span className={s.chip} style={{color:'#4ade80',borderColor:'rgba(74,222,128,.4)'}}>
                  {formatTime(playTime)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className={s.launchBar}>
          {selected ? (
            <div className={s.activeInst}>
              <div className={s.instIcon} style={{background:`${icolor}10`,borderColor:`${icolor}30`}}>
                <span style={{color:icolor,fontFamily:'var(--disp)',fontWeight:700,fontSize:13}}>{itext}</span>
              </div>
              <div>
                <div className={s.instName}>{selected.name}</div>
                <div className={s.instMeta}>{selected.mcVersion} · {selected.loader}</div>
              </div>
            </div>
          ) : (
            <div className={s.noInst}>No instance selected</div>
          )}
          <div style={{flex:1}}/>
          {launchError && <span className={s.errTxt} title={launchError}>{launchError.substring(0,40)}...</span>}
          <button className={s.consoleBtn} type="button" onClick={()=>setShowConsole(v=>!v)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x=".5" y=".5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1"/>
              <path d="M2 4L5 6.5L2 9M6 9H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Console
          </button>
          <button type="button" className={s.newBtn} onClick={()=>setShowCreate(true)}>+ New</button>
          {launchState === 'running' ? (
            <button type="button" className={`${s.launchBtn} ${s.stopBtn}`} onClick={stopGame}>
              STOP
            </button>
          ) : (
            <button type="button"
              className={`${s.launchBtn} ${launchState!=='idle'?s[launchState]:''}`}
              onClick={handleLaunch}
              disabled={launchState!=='idle'||!selected}>
              {lbl}
            </button>
          )}
        </div>
      </div>

      {showConsole && (
        <div className={s.consolePanel}>
          <div className={s.consoleHeader}>
            <span>CLIENT CONSOLE</span>
            <button type="button" onClick={()=>setConsole([])} style={{fontSize:11,color:'var(--t2)',background:'transparent',border:'none',cursor:'pointer'}}>Clear</button>
            <button type="button" onClick={()=>setShowConsole(false)} style={{fontSize:11,color:'var(--t2)',background:'transparent',border:'none',cursor:'pointer'}}>✕</button>
          </div>
          <div className={s.consoleLogs}>
            {console_.length === 0 && <div style={{color:'var(--t3)',fontSize:11}}>No logs yet...</div>}
            {console_.map((l,i) => (
              <div key={i} className={s.logLine} style={{color:l.includes('ERROR')?'#f43f5e':l.includes('FIX')?'#fbbf24':'var(--t2)'}}>
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={s.body}>
        <div className={s.secHeader}>
          <div className={s.secTitle}>Instances</div>
          <button type="button" className={s.secBtn} onClick={()=>setShowCreate(true)}>+ New Instance</button>
        </div>

        {instances.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyTitle}>No instances yet</div>
            <div className={s.emptyDesc}>Create your first instance to start playing</div>
            <button type="button" className={s.emptyBtn} onClick={()=>setShowCreate(true)}>Create Instance</button>
          </div>
        ) : (
          <div className={s.grid}>
            {instances.map((inst,i) => {
              const ic = (inst as any).iconColor||'#4ade80'
              const it = (inst as any).iconText||inst.name.substring(0,2).toUpperCase()
              const lc = LC[inst.loader]||'#a78bfa'
              const isSelected = selectedId===inst.id
              return (
                <div key={inst.id}
                  className={`${s.card} ${isSelected?s.cardSel:''}`}
                  onClick={()=>setSelectedId(inst.id)}
                  style={{animationDelay:`${i*.05}s`}}>
                  <div className={s.cardTopBar} style={{background:`linear-gradient(90deg,transparent,${ic},transparent)`}}/>
                  <div className={s.cardIcon} style={{background:`${ic}10`,borderColor:`${ic}30`}}>
                    <span style={{color:ic,fontFamily:'var(--disp)',fontWeight:700,fontSize:16}}>{it}</span>
                  </div>
                  <div className={s.cardName}>{inst.name}</div>
                  <div className={s.cardVer}>{inst.mcVersion}</div>
                  <div className={s.cardLoader} style={{color:lc}}>{inst.loader.toUpperCase()}</div>
                  {inst.lastPlayed && <div className={s.cardPlayed}>{new Date(inst.lastPlayed).toLocaleDateString()}</div>}
                  <button type="button" className={s.delBtn}
                    onClick={e=>{e.stopPropagation();setConfirmDelete(inst.id)}}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.3"/></svg>
                  </button>
                </div>
              )
            })}
            <div className={s.addCard} onClick={()=>setShowCreate(true)}>
              <div className={s.addPlus}>+</div>
              <div className={s.addLbl}>New Instance</div>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:998,animation:'fadeIn .15s ease'}}>
          <div style={{
            background:'#0d0d12',
            border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:28,width:320,
            boxShadow:'0 24px 60px rgba(0,0,0,.9)',
            animation:'slideUp .22s var(--smooth)'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:600,color:'var(--t1)'}}>Delete Instance?</div>
            </div>
            <div style={{fontSize:13,color:'var(--t2)',marginBottom:20,lineHeight:1.6}}>
              This removes the instance profile. Your saves and mods files are kept in AppData.
            </div>
            <div style={{display:'flex',gap:10}}>
              <button type="button" onClick={()=>setConfirmDelete(null)} style={{
                flex:1,padding:'10px',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',
                color:'var(--t2)',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'
              }}>Cancel</button>
              <button type="button" onClick={()=>handleDelete(confirmDelete)} style={{
                flex:1,padding:'10px',background:'#dc2626',
                border:'none',color:'#fff',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && <CreateInstanceModal onClose={()=>setShowCreate(false)} onCreated={handleCreated}/>}
    </div>
  )
}
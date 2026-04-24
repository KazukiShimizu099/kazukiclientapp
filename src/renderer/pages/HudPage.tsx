import { useState, useEffect } from 'react'
import s from './HudPage.module.css'

interface HudMod { id:string; name:string; cat:string; enabled:boolean; color:string }

const DEFAULTS: HudMod[] = [
  // Performance
  {id:'fps',     name:'FPS Counter',      cat:'Performance', enabled:true,  color:'#4ade80'},
  {id:'ping',    name:'Ping / MS',        cat:'Performance', enabled:true,  color:'#00d4ff'},
  {id:'tps',     name:'Server TPS',       cat:'Performance', enabled:false, color:'#00d4ff'},
  {id:'ram',     name:'RAM Usage',        cat:'Performance', enabled:false, color:'#a78bfa'},
  {id:'cpu',     name:'CPU Usage',        cat:'Performance', enabled:false, color:'#f97316'},
  {id:'chunks',  name:'Chunk Updates',    cat:'Performance', enabled:false, color:'#f5c842'},
  // Player
  {id:'cps',     name:'CPS Display',      cat:'Player', enabled:true,  color:'#4ade80'},
  {id:'keys',    name:'Keystrokes',       cat:'Player', enabled:true,  color:'#00d4ff'},
  {id:'armor',   name:'Armor HUD',        cat:'Player', enabled:false, color:'#f5c842'},
  {id:'effects', name:'Potion Effects',   cat:'Player', enabled:false, color:'#a78bfa'},
  {id:'reach',   name:'Reach Display',    cat:'Player', enabled:false, color:'#f43f5e'},
  {id:'combo',   name:'Combo Counter',    cat:'Player', enabled:false, color:'#f97316'},
  {id:'kills',   name:'Kill Streak',      cat:'Player', enabled:false, color:'#f43f5e'},
  {id:'sat',     name:'Saturation',       cat:'Player', enabled:false, color:'#4ade80'},
  // World
  {id:'coords',  name:'Coordinates',      cat:'World', enabled:false, color:'#00d4ff'},
  {id:'biome',   name:'Biome Name',       cat:'World', enabled:false, color:'#4ade80'},
  {id:'clock',   name:'Real Clock',       cat:'World', enabled:true,  color:'#a78bfa'},
  {id:'light',   name:'Light Level',      cat:'World', enabled:false, color:'#f5c842'},
  {id:'dir',     name:'Direction',        cat:'World', enabled:false, color:'#00d4ff'},
  {id:'speed',   name:'Speed',            cat:'World', enabled:false, color:'#4ade80'},
  // Visual
  {id:'score',   name:'Scoreboard',       cat:'Visual', enabled:false, color:'#a78bfa'},
  {id:'boss',    name:'Boss Bar',         cat:'Visual', enabled:true,  color:'#f43f5e'},
  {id:'cross',   name:'Custom Crosshair', cat:'Visual', enabled:true,  color:'#00d4ff'},
  {id:'cbound',  name:'Chunk Borders',    cat:'Visual', enabled:false, color:'#f5c842'},
  {id:'hitbox',  name:'Entity Hitbox',    cat:'Visual', enabled:false, color:'#f43f5e'},
  {id:'fov',     name:'FOV Changer',      cat:'Visual', enabled:false, color:'#a78bfa'},
  // Combat
  {id:'target',  name:'Target HUD',       cat:'Combat', enabled:false, color:'#f43f5e'},
  {id:'arrows',  name:'Arrow Count',      cat:'Combat', enabled:false, color:'#f5c842'},
  {id:'ctime',   name:'Click Timing',     cat:'Combat', enabled:false, color:'#f97316'},
]

const CATS = ['All','Performance','Player','World','Visual','Combat']

const STORAGE_KEY = 'kazuki_hud_modules'

export default function HudPage() {
  const [mods, setMods] = useState<HudMod[]>(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge saved enabled state into defaults
        return DEFAULTS.map(d => ({ ...d, enabled: parsed[d.id] ?? d.enabled }))
      }
    } catch {}
    return DEFAULTS
  })
  const [cat, setCat] = useState('All')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)

  // Save to localStorage whenever mods change
  useEffect(() => {
    const state: Record<string,boolean> = {}
    mods.forEach(m => { state[m.id] = m.enabled })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    // Also persist to settings
    window.kazuki?.settings.set('hudModules', state)
  }, [mods])

  function toggle(id: string) {
    setMods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
    setSaved(true)
    setTimeout(() => setSaved(false), 800)
  }

  function enableAll()  { setMods(prev => prev.map(m => ({ ...m, enabled: true  }))) }
  function disableAll() { setMods(prev => prev.map(m => ({ ...m, enabled: false }))) }

  const filtered = mods
    .filter(m => cat === 'All' || m.cat === cat)
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))

  const enabledCount = mods.filter(m => m.enabled).length

  const LIVE_STATS = [
    { label:'FPS',  value:'247', color:'#4ade80' },
    { label:'Ping', value:'12ms', color:'#00d4ff' },
    { label:'CPS',  value:'8.4',  color:'#f5c842' },
    { label:'RAM',  value:'3.2G', color:'#a78bfa' },
    { label:'TPS',  value:'20.0', color:'#4ade80' },
  ]

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <div className={s.title}><span className={s.accent}>HUD</span> MODULES</div>
          <div className={s.subtitle}>{enabledCount}/{mods.length} active · Right Shift in-game to toggle</div>
        </div>
        <div className={s.hActions}>
          {saved && <span className={s.savedBadge}>Saved</span>}
          <button type="button" className={s.actionBtn} onClick={disableAll}>Disable All</button>
          <button type="button" className={`${s.actionBtn} ${s.primary}`} onClick={enableAll}>Enable All</button>
        </div>
      </div>

      {/* Live stats preview */}
      <div className={s.statsRow}>
        {LIVE_STATS.map(st => (
          <div key={st.label} className={s.statCard}>
            <div className={s.statVal} style={{color:st.color}}>{st.value}</div>
            <div className={s.statLbl}>{st.label}</div>
          </div>
        ))}
        <div className={s.statNote}>
          HUD is built into Kazuki Client — works in-game automatically.
          Press <kbd>Right Shift</kbd> in-game to open/close HUD menu.
        </div>
      </div>

      {/* Filters */}
      <div className={s.filterRow}>
        <div className={s.catTabs}>
          {CATS.map(c => (
            <button key={c} type="button"
              className={`${s.catBtn} ${cat===c?s.catActive:''}`}
              onClick={() => setCat(c)}>
              {c}
              <span className={s.catCount}>
                {c==='All' ? mods.length : mods.filter(m=>m.cat===c).length}
              </span>
            </button>
          ))}
        </div>
        <div style={{position:'relative',flexShrink:0}}>
          <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--t3)',pointerEvents:'none'}} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 8L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input className={s.searchIn} type="text" placeholder="Filter..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>

      {/* Grid */}
      <div className={s.grid}>
        {filtered.map((mod, i) => (
          <div key={mod.id}
            className={`${s.modCard} ${mod.enabled ? s.enabled : ''}`}
            onClick={() => toggle(mod.id)}
            style={{
              animationDelay:`${i*.02}s`,
              borderColor: mod.enabled ? mod.color+'44' : undefined,
              background: mod.enabled ? mod.color+'08' : undefined,
            }}>
            <div className={s.modLeft}>
              <div className={s.modDot} style={{
                background: mod.enabled ? mod.color : 'rgba(255,255,255,.1)',
                boxShadow: mod.enabled ? `0 0 8px ${mod.color}88` : undefined
              }}/>
              <div>
                <div className={s.modName} style={{color: mod.enabled ? 'var(--t1)' : 'var(--t2)'}}>{mod.name}</div>
                <div className={s.modCat}>{mod.cat}</div>
              </div>
            </div>
            <div className={`${s.toggle} ${mod.enabled?s.toggleOn:''}`}
              style={mod.enabled?{background:mod.color}:undefined}>
              <div className={s.thumb}/>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className={s.empty}>No modules match</div>
        )}
      </div>

      <div className={s.footer}>
        HUD modules are rendered directly by Kazuki Client. No Fabric mod needed. Modules save automatically.
      </div>
    </div>
  )
}

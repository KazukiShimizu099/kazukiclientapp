import { useState, useEffect } from 'react'
import s from './DiscordPage.module.css'

export default function DiscordPage() {
  const [enabled, setEnabled] = useState(true)
  const [connected, setConnected] = useState(false)
  const [details, setDetails] = useState('Kazuki Client v1.0')
  const [state, setState] = useState('In Launcher')
  const [showTimer, setShowTimer] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [btn1Label, setBtn1Label] = useState('Get Kazuki Client')
  const [btn1Url, setBtn1Url]     = useState('https://github.com/kazuki-client')
  const [btn2Label, setBtn2Label] = useState('Discord Server')
  const [btn2Url, setBtn2Url]     = useState('https://discord.gg/kazuki')

  useEffect(() => {
    window.kazuki?.discord.getConfig().then((r: any) => {
      if (r?.success) {
        const c = r.config
        setEnabled(c.enabled ?? true)
        setDetails(c.details || 'Kazuki Client v1.0')
        setState(c.state || 'In Launcher')
        setShowTimer(c.showElapsedTime ?? true)
        setBtn1Label(c.customButton1Label || '')
        setBtn1Url(c.customButton1Url || '')
        setBtn2Label(c.customButton2Label || '')
        setBtn2Url(c.customButton2Url || '')
        setConnected(r.connected || false)
      }
    })
  }, [])

  async function save() {
    setSaving(true)
    await window.kazuki?.discord.setConfig({
      enabled, details, state, showElapsedTime: showTimer,
      customButton1Label: btn1Label, customButton1Url: btn1Url,
      customButton2Label: btn2Label, customButton2Url: btn2Url,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Refresh status
    const r = await window.kazuki?.discord.getStatus()
    if (r) setConnected(r.connected)
  }

  async function reconnect() {
    const r = await window.kazuki?.discord.reconnect()
    setConnected(r?.connected || false)
  }

  const PRESETS = [
    ['Launcher', 'Kazuki Client v1.0', 'Browsing Launcher'],
    ['In Game',  'Playing Minecraft',  'Kazuki Client'],
    ['PvP',      'Destroying in PvP',  'Kazuki Client'],
    ['Building', 'Building Something', 'Creative Mode'],
    ['AFK',      'AFK...',             'Kazuki Client v1.0'],
  ]

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.title}><span className={s.accent}>DISCORD</span> RPC</div>
        <div className={s.headerRight}>
          <div className={`${s.statusBadge} ${connected?s.online:s.offline}`}>
            <div className={s.dot}/>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          <button className={s.reconnectBtn} type="button" onClick={reconnect}>Reconnect</button>
          {saved && <div className={s.savedBadge}>Saved</div>}
        </div>
      </div>

      <div className={s.content}>
        {/* Master toggle */}
        <div className={s.card}>
          <div className={s.cardRow}>
            <div>
              <div className={s.rowLabel}>Enable Discord Rich Presence</div>
              <div className={s.rowSub}>Show Kazuki Client activity on your Discord profile</div>
            </div>
            <div className={`${s.toggle} ${enabled?s.toggleOn:''}`}
              style={enabled?{background:'linear-gradient(90deg,var(--leaf),var(--leaf2))'}:undefined}
              onClick={() => setEnabled(v=>!v)}>
              <div className={s.thumb}/>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className={s.previewCard}>
          <div className={s.previewTitle}>PREVIEW</div>
          <div className={s.discordCard}>
            <div className={s.dcHeader}>
              <svg width="18" height="14" viewBox="0 0 71 55" fill="#5865f2"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.4a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.6-1.8 3.7a54 54 0 0 0-16.2 0 37.4 37.4 0 0 0-1.8-3.7.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.9 4.9a.2.2 0 0 0-.1.1C1.6 18.1-1 30.9.3 43.5a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 9 .2.2 0 0 0 .2-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.8.6 1.1.9a.2.2 0 0 1 0 .4 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3c1.1 2.1 2.3 4.1 3.6 6a.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 17.8-9 .2.2 0 0 0 .1-.2C73 28.9 69.7 16.2 60.2 5a.2.2 0 0 0-.1-.1z"/></svg>
              <span>Discord</span>
            </div>
            <div className={s.dcBody}>
              <div className={s.dcImg}>
                <img src="logo32.png" style={{width:64,height:64,borderRadius:8,objectFit:'contain'}} alt=""
                  onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
              </div>
              <div className={s.dcInfo}>
                <div className={s.dcApp}>PLAYING A GAME</div>
                <div className={s.dcGame}>Kazuki Client</div>
                <div className={s.dcDetails}>{details||'Kazuki Client v1.0'}</div>
                <div className={s.dcState}>{state||'In Launcher'}</div>
                {showTimer && <div className={s.dcTime}>00:12:34 elapsed</div>}
                {btn1Label && <div className={s.dcBtn}>{btn1Label}</div>}
                {btn2Label && <div className={s.dcBtn}>{btn2Label}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className={s.card}>
          <div className={s.cardTitle}>Quick Presets</div>
          <div className={s.presets}>
            {PRESETS.map(([l,d,st]) => (
              <button key={l} type="button" className={s.preset}
                onClick={() => { setDetails(d); setState(st) }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Text */}
        <div className={s.card}>
          <div className={s.cardTitle}>Presence Text</div>
          <div className={s.fields}>
            <div className={s.field}>
              <label className={s.label}>Details (top)</label>
              <input className={s.inp} type="text" maxLength={128}
                value={details} onChange={e=>setDetails(e.target.value)} placeholder="Kazuki Client v1.0"/>
            </div>
            <div className={s.field}>
              <label className={s.label}>State (bottom)</label>
              <input className={s.inp} type="text" maxLength={128}
                value={state} onChange={e=>setState(e.target.value)} placeholder="In Launcher"/>
            </div>
          </div>
          <div className={s.cardRow} style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,.04)'}}>
            <div><div className={s.rowLabel}>Show Elapsed Time</div></div>
            <div className={`${s.toggle} ${showTimer?s.toggleOn:''}`}
              style={showTimer?{background:'linear-gradient(90deg,var(--purple),var(--cyan))'}:undefined}
              onClick={()=>setShowTimer(v=>!v)}>
              <div className={s.thumb}/>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className={s.card}>
          <div className={s.cardTitle}>Buttons (max 2)</div>
          <div className={s.fields}>
            <div className={s.twoCol}>
              <div className={s.field}>
                <label className={s.label}>Button 1 Label</label>
                <input className={s.inp} type="text" maxLength={32} value={btn1Label} onChange={e=>setBtn1Label(e.target.value)} placeholder="Get Kazuki"/>
              </div>
              <div className={s.field}>
                <label className={s.label}>Button 1 URL</label>
                <input className={s.inp} type="text" value={btn1Url} onChange={e=>setBtn1Url(e.target.value)} placeholder="https://..."/>
              </div>
              <div className={s.field}>
                <label className={s.label}>Button 2 Label</label>
                <input className={s.inp} type="text" maxLength={32} value={btn2Label} onChange={e=>setBtn2Label(e.target.value)} placeholder="Discord"/>
              </div>
              <div className={s.field}>
                <label className={s.label}>Button 2 URL</label>
                <input className={s.inp} type="text" value={btn2Url} onChange={e=>setBtn2Url(e.target.value)} placeholder="https://..."/>
              </div>
            </div>
          </div>
        </div>

        <button className={s.saveBtn} type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Apply'}
        </button>

        <div className={s.note}>
          To set up Discord RPC: Create an application at discord.com/developers → copy Application ID → replace CLIENT_ID in src/main/discord/handlers.ts
        </div>
      </div>
    </div>
  )
}

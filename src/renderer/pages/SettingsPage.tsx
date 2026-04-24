import { useState, useEffect } from 'react'
import s from './SettingsPage.module.css'

interface Settings {
  closeOnLaunch: boolean
  discordRpc: boolean
  autoUpdate: boolean
  defaultMaxRam: number
  defaultMinRam: number
  javaPath: string
  gameDir: string
  sendCrashReports: boolean
  // Client visibility
  hideOnGame: boolean
  minimizeOnGame: boolean
  showTaskbar: boolean
  // HUD
  hudEnabled: boolean
  hudOpacity: number
}

const DEF: Settings = {
  closeOnLaunch: false, discordRpc: true, autoUpdate: true,
  defaultMaxRam: 2048, defaultMinRam: 512,
  javaPath: '', gameDir: '', sendCrashReports: true,
  hideOnGame: false, minimizeOnGame: true, showTaskbar: true,
  hudEnabled: true, hudOpacity: 100,
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Settings>(DEF)
  const [sysInfo, setSysInfo] = useState<any>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.kazuki?.settings.get().then((r: any) => {
      if (r?.success) setCfg({ ...DEF, ...r.settings })
    })
    window.kazuki?.settings.systemInfo().then((r: any) => setSysInfo(r))
  }, [])

  async function set(key: keyof Settings, value: any) {
    const next = { ...cfg, [key]: value }
    setCfg(next)
    await window.kazuki?.settings.set(key, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function Toggle({ k }: { k: keyof Settings }) {
    const on = !!cfg[k]
    return (
      <div className={`${s.toggle} ${on ? s.on : ''}`} onClick={() => set(k, !on)}>
        <div className={s.thumb}/>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.title}><span className={s.accent}>CLIENT</span> SETTINGS</div>
        {saved && <div className={s.savedBadge}>Saved</div>}
      </div>

      <div className={s.content}>
        {/* System info */}
        {sysInfo && (
          <div className={s.sysCard}>
            <div className={s.sysItem}><span>RAM</span><strong>{sysInfo.totalRam}GB total</strong></div>
            <div className={s.sysItem}><span>CPU</span><strong style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sysInfo.cpu?.split('@')[0]?.trim()}</strong></div>
            <div className={s.sysItem}><span>Recommended RAM</span><strong style={{color:'var(--green)'}}>{Math.round(sysInfo.autoRam/1024)}G</strong></div>
            <div className={s.sysItem}><span>Platform</span><strong>{sysInfo.platform} {sysInfo.arch}</strong></div>
          </div>
        )}

        {/* Performance */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Performance</div>
          <div className={s.card}>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>Default Max RAM</div><div className={s.rowSub}>Per-instance override in Create Instance</div></div>
              <div className={s.sliderWrap}>
                <input type="range" min={1024} max={sysInfo ? Math.floor(sysInfo.totalRam*1024*.75/512)*512 : 8192} step={512}
                  value={cfg.defaultMaxRam} className={s.slider}
                  onChange={e => set('defaultMaxRam', Number(e.target.value))}/>
                <span className={s.sliderVal}>{Math.round(cfg.defaultMaxRam/1024)}G</span>
              </div>
            </div>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>Default Min RAM</div></div>
              <div className={s.sliderWrap}>
                <input type="range" min={256} max={2048} step={256}
                  value={cfg.defaultMinRam} className={s.slider}
                  onChange={e => set('defaultMinRam', Number(e.target.value))}/>
                <span className={s.sliderVal}>{cfg.defaultMinRam}M</span>
              </div>
            </div>
          </div>
        </div>

        {/* Client Visibility */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Client Visibility</div>
          <div className={s.card}>
            <div className={s.row}>
              <div className={s.rowInfo}>
                <div className={s.rowLabel}>Minimize on Game Launch</div>
                <div className={s.rowSub}>Hide launcher to taskbar when Minecraft starts</div>
              </div>
              <Toggle k="minimizeOnGame"/>
            </div>
            <div className={s.row}>
              <div className={s.rowInfo}>
                <div className={s.rowLabel}>Hide Completely on Launch</div>
                <div className={s.rowSub}>No taskbar icon while playing (use tray icon to restore)</div>
              </div>
              <Toggle k="hideOnGame"/>
            </div>
            <div className={s.row}>
              <div className={s.rowInfo}>
                <div className={s.rowLabel}>Show in Taskbar</div>
                <div className={s.rowSub}>Keep Kazuki Client visible in taskbar</div>
              </div>
              <Toggle k="showTaskbar"/>
            </div>
          </div>
        </div>

        {/* Launcher */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Launcher</div>
          <div className={s.card}>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>Discord Rich Presence</div><div className={s.rowSub}>Show activity on Discord (configure in Discord tab)</div></div>
              <Toggle k="discordRpc"/>
            </div>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>Auto Update</div><div className={s.rowSub}>Download Kazuki Client updates automatically</div></div>
              <Toggle k="autoUpdate"/>
            </div>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>Send Crash Reports</div><div className={s.rowSub}>Help improve stability (anonymous)</div></div>
              <Toggle k="sendCrashReports"/>
            </div>
          </div>
        </div>

        {/* HUD */}
        <div className={s.section}>
          <div className={s.sectionTitle}>In-Game HUD</div>
          <div className={s.card}>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>HUD Enabled</div><div className={s.rowSub}>Show Kazuki HUD overlay in-game (requires Fabric mod)</div></div>
              <Toggle k="hudEnabled"/>
            </div>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>HUD Opacity</div></div>
              <div className={s.sliderWrap}>
                <input type="range" min={20} max={100} step={5}
                  value={cfg.hudOpacity} className={s.slider}
                  onChange={e => set('hudOpacity', Number(e.target.value))}/>
                <span className={s.sliderVal}>{cfg.hudOpacity}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Java */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Java</div>
          <div className={s.card}>
            <div className={s.row}>
              <div className={s.rowInfo}><div className={s.rowLabel}>Java Path</div><div className={s.rowSub}>Leave blank for auto-detect</div></div>
            </div>
            <input className={s.pathInput} type="text"
              placeholder="C:\Program Files\Java\jdk-21.0.9\bin\javaw.exe"
              value={cfg.javaPath}
              onChange={e => set('javaPath', e.target.value)}/>
          </div>
        </div>

        {/* About */}
        <div className={s.section}>
          <div className={s.sectionTitle}>About</div>
          <div className={s.card}>
            <div className={s.aboutRow}>
              <div className={s.aboutLogo}>K</div>
              <div>
                <div className={s.aboutName}>Kazuki Client</div>
                <div className={s.aboutVer}>v1.0.0 · Windows x64 · Java 21</div>
              </div>
            </div>
            <div className={s.aboutLinks}>
              <div className={s.aboutLink}>GitHub</div>
              <div className={s.aboutLink}>Discord</div>
              <div className={s.aboutLink}>Report Bug</div>
            </div>
            <div className={s.jvmNote}>
              JVM: G1GC + ParallelRefProcEnabled + DisableExplicitGC active by default for max FPS.
              Kazuki Client auto-detects Oracle JDK, Adoptium, Temurin, Zulu, Corretto, Microsoft JDK.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

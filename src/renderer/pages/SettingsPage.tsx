import { useState, useEffect } from 'react'
import s from './SettingsPage.module.css'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({
    minRam: 1024, maxRam: 4096, resolutionWidth: 1280, resolutionHeight: 720, minimizeOnGame: true, closeOnGame: false
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await window.kazuki?.settings.get()
      if (res?.settings) setSettings(prev => ({...prev, ...res.settings}))
    }
    load()
  }, [])

  async function save(key: string, val: any) {
    setSaving(true)
    const updated = { ...settings, [key]: val }
    setSettings(updated)
    await window.kazuki?.settings.set(key, val)
    setTimeout(() => setSaving(false), 300)
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.title}>Client Settings</div>
        {saving && <span className={s.saving}>Saving...</span>}
      </div>

      <div className={s.section}>
        <div className={s.secTitle}>Java & Memory Allocation</div>
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.info}>
              <div className={s.lbl}>Default Max RAM (MB)</div>
              <div className={s.desc}>Limit the maximum memory Minecraft can use globally.</div>
            </div>
            <input type="number" value={settings.maxRam || 4096} onChange={e=>save('maxRam', Number(e.target.value))} className={s.inputBox} />
          </div>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.secTitle}>Game Resolution</div>
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.info}>
              <div className={s.lbl}>Window Width</div>
            </div>
            <input type="number" value={settings.resolutionWidth || 1280} onChange={e=>save('resolutionWidth', Number(e.target.value))} className={s.inputBox} />
          </div>
          <div className={s.divider} />
          <div className={s.row}>
            <div className={s.info}>
              <div className={s.lbl}>Window Height</div>
            </div>
            <input type="number" value={settings.resolutionHeight || 720} onChange={e=>save('resolutionHeight', Number(e.target.value))} className={s.inputBox} />
          </div>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.secTitle}>Launcher Behavior</div>
        <div className={s.card}>
          <div className={s.row}>
            <div className={s.info}>
              <div className={s.lbl}>Minimize on Launch</div>
              <div className={s.desc}>Hide Kazuki Client to system tray when game starts.</div>
            </div>
            <label className={s.switch}>
              <input type="checkbox" checked={!!settings.minimizeOnGame} onChange={e=>save('minimizeOnGame', e.target.checked)} />
              <span className={s.slider}></span>
            </label>
          </div>
          <div className={s.divider} />
          <div className={s.row}>
            <div className={s.info}>
              <div className={s.lbl}>Close on Launch</div>
              <div className={s.desc}>Completely exit launcher to save resources.</div>
            </div>
            <label className={s.switch}>
              <input type="checkbox" checked={!!settings.closeOnGame} onChange={e=>save('closeOnGame', e.target.checked)} />
              <span className={s.slider}></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
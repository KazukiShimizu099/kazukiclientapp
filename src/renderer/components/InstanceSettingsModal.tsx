import { useState } from 'react'
import type { Instance } from '../types'
import s from './CreateInstanceModal.module.css' // Reuse CreateInstance CSS for structure

export default function InstanceSettingsModal({ instance, onClose, onUpdated }: { instance: Instance, onClose: () => void, onUpdated: () => void }) {
  const [maxRam, setMaxRam] = useState(instance.maxRam || 2048)
  const [customArgs, setCustomArgs] = useState(instance.customJvmArgs || '')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    const r = await window.kazuki?.instance.update({ id: instance.id, data: { maxRam, customJvmArgs: customArgs } })
    if (r?.success) { onUpdated(); onClose() }
    setLoading(false)
  }

  return (
    <div className={s.overlay}>
      <div className={s.modal}>
        <div className={s.header}>
          <div className={s.title}>Settings: {instance.name}</div>
          <button className={s.close} onClick={onClose}>✕</button>
        </div>
        <div className={s.form}>
          <div className={s.field}>
            <label>Max RAM (MB)</label>
            <input type="number" value={maxRam} onChange={e=>setMaxRam(Number(e.target.value))} />
          </div>
          <div className={s.field}>
            <label>Custom JVM Args</label>
            <input value={customArgs} onChange={e=>setCustomArgs(e.target.value)} placeholder="-XX:+UseG1GC" />
          </div>
          <button onClick={save} className={s.submit} disabled={loading}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}
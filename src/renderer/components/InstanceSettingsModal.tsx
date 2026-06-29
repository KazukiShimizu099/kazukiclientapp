import { useState } from 'react'
import s from './InstanceSettingsModal.module.css'
import type { Instance } from '../../shared/types'

interface Props { instance: Instance, onClose: () => void, onUpdated: () => void }

export default function InstanceSettingsModal({ instance, onClose, onUpdated }: Props) {
  const [maxRam, setMaxRam] = useState(instance.maxRam || 2048)
  const [customArgs, setCustomArgs] = useState(instance.customJvmArgs || '')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    await window.kazuki?.instance.update({ id: instance.id, data: { maxRam, customJvmArgs: customArgs } })
    onUpdated(); onClose()
  }

  async function deleteInst() {
    if (!confirm(`Are you sure you want to delete ${instance.name}?`)) return
    setLoading(true)
    await window.kazuki?.instance.delete(instance.id)
    onUpdated(); onClose()
  }

  async function openFolder() {
    await window.kazuki?.instance.openFolder(instance.id)
  }

  return (
    <div className={s.overlay}>
      <div className={s.modal}>
        <div className={s.header}>
          <div className={s.title}>{instance.name} Settings</div>
          <button className={s.close} onClick={onClose} disabled={loading}>✕</button>
        </div>
        <div className={s.form}>
          <div className={s.field}>
            <label>Max RAM (MB)</label>
            <input type="number" value={maxRam} onChange={e=>setMaxRam(Number(e.target.value))} disabled={loading} />
          </div>
          <div className={s.field}>
            <label>Custom JVM Arguments</label>
            <input value={customArgs} onChange={e=>setCustomArgs(e.target.value)} placeholder="-XX:+UseG1GC" disabled={loading} />
          </div>
          
          <div className={s.actions}>
            <button className={s.folderBtn} onClick={openFolder} type="button">📂 Open Folder</button>
            <button className={s.deleteBtn} onClick={deleteInst} type="button" disabled={loading}>🗑 Delete</button>
          </div>

          <div className={s.footer}>
            <button onClick={onClose} className={s.cancel} disabled={loading}>Cancel</button>
            <button onClick={save} className={s.save} disabled={loading}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
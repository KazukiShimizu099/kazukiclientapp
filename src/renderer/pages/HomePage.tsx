import { useState, useEffect } from 'react'
import s from './HomePage.module.css'
import CreateInstanceModal from '../components/CreateInstanceModal'
import InstanceSettingsModal from '../components/InstanceSettingsModal'
import type { Instance } from '../../shared/types'

export default function HomePage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editingInst, setEditingInst] = useState<Instance | null>(null)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])

  async function loadInstances() {
    const r = await window.kazuki?.instance.getAll()
    if (r?.success) setInstances(r.instances)
  }

  useEffect(() => {
    loadInstances()
    window.kazuki?.on('instance:log', (msg: string) => {
      setConsoleLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])
    })
    return () => { window.kazuki?.off('instance:log') }
  }, [])

  async function launch(id: string) {
    const r = await window.kazuki?.instance.launch(id)
    if (!r?.success) alert(r?.error)
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.title}>Dashboard</div>
        <button className={s.createBtn} onClick={() => setShowCreate(true)}>+ New Instance</button>
      </div>

      <div className={s.grid}>
        {instances.map(inst => (
          <div key={inst.id} className={s.card} onClick={() => launch(inst.id)}>
            <div className={s.cardContent}>
              <div className={s.cardName}>{inst.name}</div>
              <div className={s.cardDetails}>{inst.mcVersion} • {inst.loader}</div>
            </div>
            <button 
              className={s.editBtn} 
              onClick={(e) => { e.stopPropagation(); setEditingInst(inst) }}
            >
              ⚙️
            </button>
          </div>
        ))}
      </div>

      <div className={s.consoleContainer}>
        <div className={s.consoleHeader}>System Logs</div>
        <div className={s.console}>
          {consoleLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {showCreate && <CreateInstanceModal onClose={() => setShowCreate(false)} onCreated={loadInstances} />}
      {editingInst && <InstanceSettingsModal instance={editingInst} onClose={() => setEditingInst(null)} onUpdated={loadInstances} />}
    </div>
  )
}
import { useState, useEffect, useRef } from 'react'
import s from './HomePage.module.css'
import CreateInstanceModal from '../components/CreateInstanceModal'
import InstanceSettingsModal from '../components/InstanceSettingsModal'
import type { Instance } from '../../shared/types'

export default function HomePage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editingInst, setEditingInst] = useState<Instance | null>(null)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])

  const [playingId, setPlayingId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<any>(null)

  async function loadInstances() {
    const r = await window.kazuki?.instance.getAll()
    if (r?.success) setInstances(r.instances)
  }

  useEffect(() => {
    loadInstances()
    window.kazuki?.on('instance:log', (msg: string) => {
      setConsoleLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])
    })
    
    // Auto-stop UI when backend process exits (Manual close by user)
    window.kazuki?.on('instance:stopped', (id: string) => {
      setPlayingId(prev => {
        if (prev === id) {
          if (timerRef.current) clearInterval(timerRef.current)
          return null
        }
        return prev
      })
    })

    return () => { 
      window.kazuki?.off('instance:log')
      window.kazuki?.off('instance:stopped')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startTimer(id: string) {
    setPlayingId(id)
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)
  }

  function stopTimer() {
    setPlayingId(null)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  async function toggleLaunch(id: string) {
    if (playingId === id) {
      // If currently playing, STOP it.
      await window.kazuki?.instance.kill(id)
      stopTimer()
      return
    }

    // Otherwise, LAUNCH it.
    startTimer(id)
    const r = await window.kazuki?.instance.launch(id)
    if (!r?.success) {
      alert(r?.error)
      stopTimer()
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    const h = Math.floor(secs / 3600)
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.title}>Dashboard</div>
        <button className={s.createBtn} onClick={() => setShowCreate(true)}>+ New Instance</button>
      </div>

      <div className={s.grid}>
        {instances.map(inst => (
          <div key={inst.id} className={s.card}>
            <div className={s.cardContent}>
              <div className={s.cardName}>{inst.name}</div>
              <div className={s.cardDetails}>{inst.mcVersion} • {inst.loader}</div>
            </div>
            
            <div className={s.cardActions}>
              <button 
                className={playingId === inst.id ? s.stopBtn : s.launchBtn} 
                onClick={() => toggleLaunch(inst.id)}
              >
                {playingId === inst.id ? `Stop [${formatTime(elapsed)}]` : 'Launch'}
              </button>
              <button className={s.editBtn} onClick={() => setEditingInst(inst)}>⚙️</button>
            </div>
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
import { useState, useEffect } from 'react'
import s from './CreateInstanceModal.module.css'

interface Props { onClose: ()=>void, onCreated: (inst:any)=>void }

export default function CreateInstanceModal({ onClose, onCreated }: Props) {
  const [versions, setVersions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [mcVersion, setMcVersion] = useState('')
  const [loader, setLoader] = useState<'fabric'|'forge'|'vanilla'|'optifine'>('fabric')
  const [minRam, setMinRam] = useState(1024)
  const [maxRam, setMaxRam] = useState(4096)
  const [customArgs, setCustomArgs] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  useEffect(() => {
    async function fetchVersions() {
      const r = await window.kazuki?.versions.getList()
      if (r?.success && r.versions.length > 0) {
        const vList = r.versions.map((v:any) => typeof v === 'string' ? v : v.id)
        setVersions(vList)
        setMcVersion(vList[0])
      } else {
        setVersions(['26.2', '1.21.11', '1.21.1', '1.20.4', '1.8.9'])
        setMcVersion('26.2')
      }
      setLoading(false)
    }
    fetchVersions()

    const handleProgress = (data: any) => {
      setProgress(`${data.name} (${data.percent}%)`)
    }
    window.kazuki?.on('download:progress', handleProgress)
    
    return () => {
      window.kazuki?.off('download:progress')
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Instance Name is required'); return }
    setCreating(true); setError(''); setProgress('Initializing download...')

    // Strictly blocks creation if Mojang API times out or fails
    const installRes = await window.kazuki?.versions.install(mcVersion)
    if (!installRes?.success) {
      setError(installRes?.error || 'Failed to download Minecraft files from Mojang servers.')
      setCreating(false)
      setProgress('')
      return
    }
    
    setProgress('Creating local profile folders...')
    const r = await window.kazuki?.instance.create({
      name: name.trim(),
      mcVersion,
      loader,
      minRam,
      maxRam,
      customJvmArgs: customArgs
    })

    if (r?.success) {
      onCreated(r.instance)
      onClose()
    } else {
      setError(r?.error || 'Failed to create local instance folders')
      setCreating(false)
      setProgress('')
    }
  }

  return (
    <div className={s.overlay}>
      <div className={s.modal}>
        <div className={s.header}>
          <div className={s.title}>Create New Instance</div>
          <button type="button" className={s.close} onClick={onClose} disabled={creating}>✕</button>
        </div>
        
        {loading ? (
          <div style={{padding:40, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize: 13}}>Fetching official versions from Mojang...</div>
        ) : (
          <form onSubmit={handleCreate} className={s.form}>
            <div className={s.field}>
              <label>Instance Name</label>
              <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. PvP Client" disabled={creating} />
            </div>
            
            <div className={s.row}>
              <div className={s.field}>
                <label>Minecraft Version</label>
                <select value={mcVersion} onChange={e=>setMcVersion(e.target.value)} disabled={creating}>
                  {versions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Mod Loader</label>
                <select value={loader} onChange={e=>setLoader(e.target.value as any)} disabled={creating}>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                  <option value="vanilla">Vanilla</option>
                  <option value="optifine">OptiFine</option>
                </select>
              </div>
            </div>

            <div className={s.field}>
              <label>Maximum RAM (MB)</label>
              <input type="number" min="1024" max="16384" step="512" value={maxRam} onChange={e=>setMaxRam(Number(e.target.value))} disabled={creating} />
              <div className={s.hint}>Hardware recommended limit: 2048 - 4096 MB</div>
            </div>

            <div className={s.field}>
              <label>Custom JVM Arguments</label>
              <input value={customArgs} onChange={e=>setCustomArgs(e.target.value)} placeholder="e.g. -XX:+UseZGC" disabled={creating} />
            </div>

            {error && <div className={s.error}>{error}</div>}
            
            {creating && progress && (
              <div style={{fontSize: 12, color: '#4ade80', textAlign: 'center', marginTop: '10px', fontFamily: 'var(--mono)'}}>
                {progress}
              </div>
            )}

            <div className={s.footer}>
              <button type="button" onClick={onClose} className={s.cancel} disabled={creating}>Cancel</button>
              <button type="submit" disabled={creating} className={s.submit}>
                {creating ? 'Installing...' : 'Install & Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
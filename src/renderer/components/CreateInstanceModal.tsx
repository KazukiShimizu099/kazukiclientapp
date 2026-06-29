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

  useEffect(() => {
    async function fetchVersions() {
      const r = await window.kazuki?.versions.getList()
      if (r?.success && r.versions.length > 0) {
        setVersions(r.versions)
        setMcVersion(r.versions[0])
      } else {
        setVersions(['1.21.1', '1.20.4', '1.19.4', '1.16.5', '1.8.9'])
        setMcVersion('1.21.1')
      }
      setLoading(false)
    }
    fetchVersions()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Instance Name is required'); return }
    setCreating(true); setError('')

    await window.kazuki?.versions.install(mcVersion)
    
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
      setError(r?.error || 'Failed to create instance')
      setCreating(false)
    }
  }

  return (
    <div className={s.overlay}>
      <div className={s.modal}>
        <div className={s.header}>
          <div className={s.title}>Create New Instance</div>
          <button type="button" className={s.close} onClick={onClose}>✕</button>
        </div>
        
        {loading ? (
          <div style={{padding:40, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize: 13}}>Fetching official versions from Mojang...</div>
        ) : (
          <form onSubmit={handleCreate} className={s.form}>
            <div className={s.field}>
              <label>Instance Name</label>
              <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bedwars Client" />
            </div>
            
            <div className={s.row}>
              <div className={s.field}>
                <label>Minecraft Version</label>
                <select value={mcVersion} onChange={e=>setMcVersion(e.target.value)}>
                  {versions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Mod Loader</label>
                <select value={loader} onChange={e=>setLoader(e.target.value as any)}>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                  <option value="vanilla">Vanilla</option>
                  <option value="optifine">OptiFine</option>
                </select>
              </div>
            </div>

            <div className={s.field}>
              <label>Maximum RAM (MB)</label>
              <input type="number" min="1024" max="16384" step="512" value={maxRam} onChange={e=>setMaxRam(Number(e.target.value))} />
              <div className={s.hint}>Hardware recommended limit: 2048 - 4096 MB</div>
            </div>

            <div className={s.field}>
              <label>Custom JVM Arguments</label>
              <input value={customArgs} onChange={e=>setCustomArgs(e.target.value)} placeholder="e.g. -XX:+UseShenandoahGC" />
            </div>

            {error && <div className={s.error}>{error}</div>}

            <div className={s.footer}>
              <button type="button" onClick={onClose} className={s.cancel}>Cancel</button>
              <button type="submit" disabled={creating} className={s.submit}>
                {creating ? 'Building...' : 'Create Instance'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
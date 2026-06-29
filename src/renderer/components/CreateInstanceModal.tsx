import { useState, useEffect } from 'react'
import s from './CreateInstanceModal.module.css'

interface Props { onClose: ()=>void, onCreated: (inst:any)=>void }

export default function CreateInstanceModal({ onClose, onCreated }: Props) {
  const [versions, setVersions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [mcVersion, setMcVersion] = useState('')
  const [loader, setLoader] = useState<'fabric'|'forge'|'vanilla'|'optifine'>('vanilla')
  const [maxRam, setMaxRam] = useState(4096)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  
  const [progData, setProgData] = useState({ name: '', percent: 0, detail: '' })

  useEffect(() => {
    async function fetchVersions() {
      const r = await window.kazuki?.versions.getList()
      if (r?.success && r.versions.length > 0) {
        const vList = r.versions.map((v:any) => typeof v === 'string' ? v : v.id)
        setVersions(vList)
        setMcVersion(vList[0])
      } else {
        setVersions(['1.21.1', '1.20.4', '1.19.4', '1.16.5', '1.8.9'])
        setMcVersion('1.21.1')
      }
      setLoading(false)
    }
    fetchVersions()

    const handleProgress = (data: any) => {
      setProgData({ name: data.name, percent: data.percent || 0, detail: data.detail || '' })
    }
    window.kazuki?.on('download:progress', handleProgress)
    
    return () => { window.kazuki?.off('download:progress') }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setCreating(true); setError(''); 
    setProgData({ name: 'Starting...', percent: 0, detail: '' })

    const installRes = await window.kazuki?.versions.install(mcVersion)
    if (!installRes?.success) {
      setError(installRes?.error || 'Installation failed. Check your network.')
      setCreating(false)
      return
    }
    
    setProgData({ name: 'Saving profile...', percent: 100, detail: '' })
    const r = await window.kazuki?.instance.create({
      name: name.trim(), mcVersion, loader, minRam: 1024, maxRam
    })

    if (r?.success) {
      onCreated(r.instance)
      onClose()
    } else {
      setError(r?.error || 'Profile creation failed')
      setCreating(false)
    }
  }

  return (
    <div className={s.overlay}>
      <div className={s.modal}>
        <div className={s.header}>
          <div className={s.title}>New Instance</div>
          <button type="button" className={s.close} onClick={onClose} disabled={creating}>✕</button>
        </div>
        
        {loading ? (
          <div className={s.loadingTxt}>Fetching Mojang versions...</div>
        ) : (
          <form onSubmit={handleCreate} className={s.form}>
            <div className={s.field}>
              <label>Name</label>
              <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Vanilla Client" disabled={creating} />
            </div>
            
            <div className={s.row}>
              <div className={s.field}>
                <label>Version</label>
                <select value={mcVersion} onChange={e=>setMcVersion(e.target.value)} disabled={creating}>
                  {versions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Loader</label>
                <select value={loader} onChange={e=>setLoader(e.target.value as any)} disabled={creating}>
                  <option value="vanilla">Vanilla</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                </select>
              </div>
            </div>

            <div className={s.field}>
              <label>RAM (MB)</label>
              <input type="number" min="1024" max="16384" step="512" value={maxRam} onChange={e=>setMaxRam(Number(e.target.value))} disabled={creating} />
            </div>

            {error && <div className={s.error}>{error}</div>}
            
            {creating && (
              <div className={s.progWrap}>
                <div className={s.progInfo}><span>{progData.name}</span><span>{progData.detail}</span></div>
                <div className={s.progBar}><div className={s.progFill} style={{width: `${progData.percent}%`}}/></div>
              </div>
            )}

            <div className={s.footer}>
              <button type="button" onClick={onClose} className={s.cancel} disabled={creating}>Cancel</button>
              <button type="submit" disabled={creating} className={s.submit}>{creating ? 'Working...' : 'Create'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
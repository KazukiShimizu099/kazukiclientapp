import { useState, useEffect } from 'react'
import type { Instance } from '../types'
import s from './ModsPage.module.css'

const CATEGORIES = ['all', 'performance', 'optimization', 'utility', 'library', 'worldgen']

export default function ModsPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstId, setSelectedInstId] = useState<string>('')
  const [tab, setTab] = useState<'search'|'installed'>('search')
  
  const [projectType, setProjectType] = useState<'mod'|'resourcepack'|'shader'>('mod')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  
  const [results, setResults] = useState<any[]>([])
  const [installedMods, setInstalledMods] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string|null>(null)

  useEffect(() => { loadInstances() }, [])

  useEffect(() => {
    if (selectedInstId) {
      loadInstalled() // Always load local files to track installation state
      if (tab === 'search') executeSearch()
    }
  }, [selectedInstId, tab, projectType, category])

  useEffect(() => {
    const timeout = setTimeout(() => { if (selectedInstId && tab === 'search') executeSearch() }, 500)
    return () => clearTimeout(timeout)
  }, [query])

  async function loadInstances() {
    const r = await window.kazuki?.instance.getAll()
    if (r?.success) {
      setInstances(r.instances)
      if (r.instances.length > 0) setSelectedInstId(r.instances[0].id)
    }
  }

  async function loadInstalled() {
    if (!selectedInstId) return
    const r = await window.kazuki?.mods.getInstalled(selectedInstId)
    if (r?.success) setInstalledMods(r.mods)
  }

  async function executeSearch() {
    const inst = instances.find(i => i.id === selectedInstId)
    if (!inst) return

    setLoading(true)
    const r = await window.kazuki?.mods.search({
      query, source: inst.loader, mcVersion: inst.mcVersion, projectType, category
    })
    
    if (r?.success) setResults(r.results)
    else setResults([])
    setLoading(false)
  }

  async function handleInstall(mod: any) {
    setActionLoading(mod.project_id)
    const r = await window.kazuki?.mods.install({ mod, instanceId: selectedInstId })
    if (r?.success) {
      loadInstalled() // Background refresh triggers button update
    } else {
      alert(`Install Failed: ${r.error}`)
    }
    setActionLoading(null)
  }

  async function handleRemove(modId: string, folder: string) {
    setActionLoading(modId)
    const r = await window.kazuki?.mods.remove({ modId, instanceId: selectedInstId, folder })
    if (r?.success) loadInstalled()
    setActionLoading(null)
  }

  const inst = instances.find(i => i.id === selectedInstId)

  if (instances.length === 0) {
    return (
      <div className={s.page}>
        <div className={s.empty}>Create an instance first to manage content.</div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.headerTitle}>Content Manager</div>
        <select className={s.instSelect} value={selectedInstId} onChange={e => setSelectedInstId(e.target.value)}>
          {instances.map(i => (
            <option key={i.id} value={i.id}>{i.name} ({i.mcVersion} - {i.loader})</option>
          ))}
        </select>
      </div>

      <div className={s.tabs}>
        <button className={tab==='search'?s.tabAct:s.tab} onClick={()=>setTab('search')}>Discover</button>
        <button className={tab==='installed'?s.tabAct:s.tab} onClick={()=>setTab('installed')}>Installed</button>
      </div>

      <div className={s.content}>
        {tab === 'search' && (
          <>
            <div className={s.controlsRow}>
              <div className={s.typeSelector}>
                <button className={projectType==='mod'?s.typeBtnAct:s.typeBtn} onClick={()=>setProjectType('mod')}>Mods</button>
                <button className={projectType==='resourcepack'?s.typeBtnAct:s.typeBtn} onClick={()=>setProjectType('resourcepack')}>Resource Packs</button>
                <button className={projectType==='shader'?s.typeBtnAct:s.typeBtn} onClick={()=>setProjectType('shader')}>Shaders</button>
              </div>
              <input 
                className={s.searchBar} type="text" 
                placeholder={`Search popular ${projectType}s...`} 
                value={query} onChange={e => setQuery(e.target.value)}
              />
            </div>

            {projectType === 'mod' && (
              <div className={s.cats}>
                {CATEGORIES.map(c => (
                  <button key={c} className={category===c?s.catBtnAct:s.catBtn} onClick={()=>setCategory(c)}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            )}
            
            <div className={s.grid}>
              {loading && <div className={s.noRes}>Loading data from Modrinth...</div>}
              {!loading && results.map(mod => {
                // Filename validation logic
                const isInstalled = installedMods.some(im => im.filename.toLowerCase().includes(mod.slug.toLowerCase()));
                return (
                  <div key={mod.project_id} className={s.card}>
                    <img src={mod.icon_url || 'logo.png'} className={s.icon} alt="" onError={e=>(e.target as any).src='logo.png'}/>
                    <div className={s.info}>
                      <div className={s.nameRow}>
                        <span className={s.name}>{mod.title}</span>
                        <span className={s.downloads}>↓ {Math.floor(mod.downloads/1000)}k</span>
                      </div>
                      <div className={s.desc}>{mod.description}</div>
                    </div>
                    <button 
                      className={isInstalled ? s.installedBtn : s.installBtn} 
                      onClick={() => !isInstalled && handleInstall(mod)}
                      disabled={actionLoading === mod.project_id || isInstalled}
                    >
                      {actionLoading === mod.project_id ? 'Wait...' : isInstalled ? 'Installed' : 'Install'}
                    </button>
                  </div>
                )
              })}
              {results.length === 0 && !loading && <div className={s.noRes}>No results found</div>}
            </div>
          </>
        )}

        {tab === 'installed' && (
          <div className={s.grid}>
            {!loading && installedMods.length === 0 && <div className={s.noRes}>No content installed.</div>}
            {installedMods.map(mod => (
              <div key={mod.id} className={s.card}>
                <div className={s.iconFallback}>{mod.folder === 'mods' ? 'JAR' : 'ZIP'}</div>
                <div className={s.info}>
                  <div className={s.nameRow}>
                    <span className={s.name}>{mod.name}</span>
                    <span className={s.folderTag}>{mod.folder}</span>
                  </div>
                  <div className={s.desc}>{mod.filename}</div>
                </div>
                <button 
                  className={s.removeBtn} 
                  onClick={() => handleRemove(mod.id, mod.folder)}
                  disabled={actionLoading === mod.id}
                >
                  {actionLoading === mod.id ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
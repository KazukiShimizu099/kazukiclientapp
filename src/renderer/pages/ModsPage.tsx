import { useState, useEffect, useCallback } from 'react'
import type { Instance } from '../types'
import s from './ModsPage.module.css'

interface Mod {
  id:string; project_id:string; name:string; description:string;
  author:string; downloads:number; icon_url?:string; versions:string[];
  source:'modrinth'|'curseforge'; category:string; updated:string;
}

const CATS = ['All','Performance','Optimization','Utility','Visual','Library']
const SORT_OPT = ['Downloads','Relevance','Updated']
const PAGE_SIZE = 15

const CAT_COLORS: Record<string,string> = {
  Performance:'#ff4466', Optimization:'#f97316', Utility:'#00d4ff',
  Visual:'#a78bfa', Library:'#f5c842', All:'#00d4ff'
}

const CAT_FACETS: Record<string,string[]> = {
  Performance:  ['categories:optimization','categories:performance'],
  Optimization: ['categories:optimization'],
  Utility:      ['categories:utility','categories:technology'],
  Visual:       ['categories:decoration','categories:shader','categories:resource-pack'],
  Library:      ['categories:library'],
  All:          []
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days/7)}w ago`
  return `${Math.floor(days/30)}mo ago`
}

function fmt(n: number): string {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M'
  if (n >= 1e3) return Math.round(n/1e3) + 'K'
  return String(n)
}

function mapCat(cats: string[]): string {
  if (!cats?.length) return 'Utility'
  const map: Record<string,string> = {
    optimization:'Optimization', performance:'Performance',
    utility:'Utility', decoration:'Visual', shader:'Visual',
    library:'Library', technology:'Utility', adventure:'Utility',
    combat:'Performance', fabric:'Utility',
  }
  for (const c of cats) if (map[c]) return map[c]
  return 'Utility'
}

function ModIcon({ mod }: { mod: Mod }) {
  const [ok, setOk] = useState(false)
  const color = CAT_COLORS[mod.category] || '#00d4ff'
  const iconUrl = mod.icon_url || `https://cdn.modrinth.com/data/${mod.project_id}/icon.png`

  return (
    <div style={{
      width: 50, height: 50, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
      background: `${color}18`, border: `1px solid ${color}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
    }}>
      <img
        src={iconUrl} alt=""
        style={{
          position: 'absolute', inset: 0, width: 50, height: 50,
          objectFit: 'cover', borderRadius: 9,
          opacity: ok ? 1 : 0, transition: 'opacity .25s'
        }}
        onLoad={() => setOk(true)}
        onError={() => setOk(false)}
      />
      {!ok && (
        <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 17, color, position: 'relative', zIndex: 1 }}>
          {mod.name.substring(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  )
}

export default function ModsPage() {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState('Downloads')
  const [mods, setMods] = useState<Mod[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [instances, setInstances] = useState<Instance[]>([])
  const [selInst, setSelInst] = useState('')
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.kazuki?.instance.getAll().then((r: any) => {
      if (r?.success) { setInstances(r.instances); if (r.instances[0]) setSelInst(r.instances[0].id) }
    })
  }, [])

  useEffect(() => { if (selInst) loadInstalled() }, [selInst])

  useEffect(() => {
    fetchMods(0)
  }, [cat, sort])

  async function loadInstalled() {
    const r = await window.kazuki?.mods.getInstalled(selInst)
    if (r?.success) setInstalled(new Set(r.mods.map((m: any) => m.id)))
  }

  async function fetchMods(pageNum: number) {
    setLoading(true); setError('')
    try {
      const catFacets = CAT_FACETS[cat] || []
      const facets: string[][] = [['project_type:mod']]
      if (catFacets.length > 0) {
        // OR facets within same array
        facets.push(catFacets)
      }

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
        index: sort === 'Updated' ? 'updated' : sort === 'Relevance' ? 'relevance' : 'downloads',
        facets: JSON.stringify(facets),
      })
      if (query.trim()) params.set('query', query.trim())

      const res = await fetch(`https://api.modrinth.com/v2/search?${params}`)
      if (!res.ok) throw new Error('Modrinth API error ' + res.status)
      const data = await res.json()

      const mapped: Mod[] = (data.hits || []).map((h: any) => ({
        id:          h.project_id,
        project_id:  h.project_id,
        name:        h.title,
        description: h.description,
        author:      h.author,
        downloads:   h.downloads,
        icon_url:    h.icon_url || undefined,
        versions:    h.versions || [],
        source:      'modrinth' as const,
        category:    mapCat(h.categories),
        updated:     h.date_modified ? timeAgo(h.date_modified) : 'recently',
      }))

      setMods(mapped)
      setTotal(data.total_hits || 0)
      setPage(pageNum)
    } catch (e: any) {
      setError('Modrinth fetch failed — check internet: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function doSearch() {
    fetchMods(0)
  }

  async function doInstall(mod: Mod) {
    if (!selInst) { setError('Select an instance first'); return }
    setInstalling(mod.id)
    try {
      const r = await window.kazuki?.mods.install(
        { id: mod.id, name: mod.name, source: mod.source, projectId: mod.project_id,
          description: mod.description, author: mod.author, downloads: mod.downloads, versions: mod.versions },
        selInst
      )
      if (r?.success) setInstalled(p => new Set([...p, mod.id]))
      else setError(r?.error || 'Install failed')
    } catch { setError('Install failed') }
    finally { setInstalling(null) }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <div className={s.pageTitle}><span className={s.accent}>MOD</span> BROWSER</div>
        <div className={s.topRight}>
          <select className={s.instSel} value={selInst} onChange={e => setSelInst(e.target.value)}>
            {instances.length === 0 && <option value="">Create an instance first</option>}
            {instances.map(i => <option key={i.id} value={i.id}>{i.name} ({i.mcVersion})</option>)}
          </select>
        </div>
      </div>

      <div className={s.searchSection}>
        <div className={s.sourceTabs}>
          <button type="button" className={`${s.srcTab} ${s.srcActive}`}>
            <div className={s.srcDot} style={{ background: '#1bd96a' }}/>
            Modrinth
            <span className={s.srcCount}>{total > 0 ? `${fmt(total)} results` : '60k+ mods'}</span>
          </button>
          <div className={s.fetchingLabel} style={{ opacity: loading ? 1 : 0 }}>
            <div className={s.spin} style={{ width: 12, height: 12 }}/> Fetching...
          </div>
        </div>
        <div className={s.searchRow}>
          <div className={s.searchWrap}>
            <svg className={s.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input className={s.searchIn} type="text"
              placeholder="Search Modrinth — FPS, shaders, optimization..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
            />
            {query && (
              <button className={s.clearBtn} type="button" onClick={() => { setQuery(''); }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4"/>
                </svg>
              </button>
            )}
          </div>
          <button className={s.searchBtn} type="button" onClick={doSearch} disabled={loading}>
            {loading ? <div className={s.spin}/> : 'Search'}
          </button>
          <select className={s.sortSel} value={sort} onChange={e => { setSort(e.target.value) }}>
            {SORT_OPT.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        {error && <div className={s.errBar}>{error}</div>}
      </div>

      <div className={s.catRow}>
        {CATS.map(c => (
          <button key={c} type="button"
            className={`${s.catBtn} ${cat === c ? s.catActive : ''}`}
            onClick={() => { setCat(c) }}
            style={cat === c && c !== 'All'
              ? { borderColor: `${CAT_COLORS[c]}44`, color: CAT_COLORS[c], background: `${CAT_COLORS[c]}0d` }
              : undefined}>
            {c}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
          {total > 0 ? `${total.toLocaleString()} mods` : ''}
        </div>
      </div>

      <div className={s.list}>
        {mods.length === 0 && !loading && (
          <div className={s.empty}>
            <div className={s.emptyTitle}>No mods found</div>
            <div className={s.emptySub}>Try a different search or category</div>
          </div>
        )}
        {mods.map((mod, i) => {
          const color = CAT_COLORS[mod.category] || '#00d4ff'
          const isInst = installed.has(mod.id)
          const isIng = installing === mod.id
          return (
            <div key={mod.id} className={s.modCard} style={{ animationDelay: `${i * .025}s` }}>
              <ModIcon mod={mod}/>
              <div className={s.modInfo}>
                <div className={s.modHeader}>
                  <div className={s.modName}>{mod.name}</div>
                  <div className={s.catTag} style={{ color, borderColor: `${color}33`, background: `${color}0d` }}>
                    {mod.category}
                  </div>
                </div>
                <div className={s.modDesc}>{mod.description}</div>
                <div className={s.modMeta}>
                  <span className={s.metaItem}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M5.5 1V8M2 5.5L5.5 9L9 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {fmt(mod.downloads)}
                  </span>
                  <span className={s.metaDot}/>
                  <span className={s.metaItem}>by {mod.author}</span>
                  <span className={s.metaDot}/>
                  <span className={s.metaItem}>{mod.updated}</span>
                </div>
              </div>
              <div className={s.modAction}>
                {isInst ? (
                  <div className={s.installedBadge}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Installed
                  </div>
                ) : (
                  <button className={s.installBtn} type="button"
                    onClick={() => doInstall(mod)} disabled={!!installing}>
                    {isIng ? <div className={s.spin}/> : <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1V9M3 6L6 10L9 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Install
                    </>}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={s.pagination}>
          <button className={s.pageBtn} type="button"
            disabled={page === 0} onClick={() => fetchMods(page - 1)}>
            ← Prev
          </button>
          <div className={s.pageInfo}>
            Page {page + 1} of {totalPages}
          </div>
          {/* Page numbers */}
          <div className={s.pageNums}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = page - 2 + i
              if (p < 0) p = i
              if (p >= totalPages) p = totalPages - 5 + i
              p = Math.max(0, Math.min(totalPages - 1, p))
              return (
                <button key={p} type="button"
                  className={`${s.pageNum} ${p === page ? s.pageNumActive : ''}`}
                  onClick={() => fetchMods(p)}>
                  {p + 1}
                </button>
              )
            })}
          </div>
          <button className={s.pageBtn} type="button"
            disabled={page >= totalPages - 1} onClick={() => fetchMods(page + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

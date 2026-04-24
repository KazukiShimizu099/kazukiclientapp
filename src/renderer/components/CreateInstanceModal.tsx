import { useState, useEffect } from 'react'
import s from './CreateInstanceModal.module.css'

interface Props { onClose:()=>void; onCreated:(i:any)=>void }

const MC_VERSIONS = [
  {id:'26.1.1',label:'26.1.1',tag:'Latest'},
  {id:'26.1',label:'26.1',tag:''},
  {id:'1.21.4',label:'1.21.4',tag:'Stable'},
  {id:'1.21.1',label:'1.21.1',tag:''},
  {id:'1.21',label:'1.21',tag:''},
  {id:'1.20.6',label:'1.20.6',tag:''},
  {id:'1.20.4',label:'1.20.4',tag:''},
  {id:'1.20.1',label:'1.20.1',tag:'Popular'},
  {id:'1.19.4',label:'1.19.4',tag:''},
  {id:'1.19.2',label:'1.19.2',tag:''},
  {id:'1.18.2',label:'1.18.2',tag:''},
  {id:'1.17.1',label:'1.17.1',tag:''},
  {id:'1.16.5',label:'1.16.5',tag:'Popular'},
  {id:'1.15.2',label:'1.15.2',tag:''},
  {id:'1.12.2',label:'1.12.2',tag:'Classic'},
  {id:'1.8.9',label:'1.8.9',tag:'PvP'},
]

const LOADERS = [
  {id:'fabric',name:'Fabric',desc:'Best performance, modern mods',color:'#00b4d8'},
  {id:'forge', name:'Forge', desc:'Largest mod ecosystem',color:'#f0b429'},
  {id:'vanilla',name:'Vanilla',desc:'Pure Minecraft, no mods',color:'#4a6680'},
]

const ICON_COLORS = ['#00b4d8','#7c3aed','#00e5a0','#f0b429','#ef4444','#ec4899','#f97316','#84cc16','#06b6d4','#8b5cf6']
const ICON_SHAPES = ['square','circle','diamond','hexagon']

type Step = 0|1|2

export default function CreateInstanceModal({onClose,onCreated}:Props) {
  const [step,setStep] = useState<Step>(0)
  // Step 0 - Info
  const [name,setName] = useState('')
  const [iconColor,setIconColor] = useState('#00b4d8')
  const [iconText,setIconText] = useState('')
  const [iconShape,setIconShape] = useState('square')
  const [maxRam,setMaxRam] = useState(2048)
  const [minRam,setMinRam] = useState(512)
  const [javaPath,setJavaPath] = useState('')
  const [jvmArgs,setJvmArgs] = useState('')
  // Step 1 - Version
  const [mcVersion,setMcVersion] = useState('26.1.1')
  const [loader,setLoader] = useState('fabric')
  // Step 2 - Install
  const [installing,setInstalling] = useState(false)
  const [done,setDone] = useState(false)
  const [error,setError] = useState('')
  const [progress,setProgress] = useState({name:'',percent:0})
  const [nameErr,setNameErr] = useState('')

  useEffect(()=>{
    window.kazuki?.on('download:progress',(d:any)=>{
      setProgress({name:d.name||'',percent:d.percent||0})
    })
    return ()=>window.kazuki?.off('download:progress')
  },[])

  const displayText = iconText||(name?name.substring(0,2).toUpperCase():'KZ')

  function getBorderRadius(shape:string){
    if(shape==='circle') return '50%'
    if(shape==='diamond') return '4px'
    if(shape==='hexagon') return '30% 70% 70% 30% / 30% 30% 70% 70%'
    return '10px'
  }

  function validate(){
    if(!name.trim()){setNameErr('Name required');return false}
    setNameErr('');return true
  }

  async function install(){
    setInstalling(true);setError('')
    try{
      setProgress({name:'Fetching version manifest...',percent:5})
      const r1 = await window.kazuki?.versions.install(mcVersion)
      if(!r1?.success) throw new Error(r1?.error||'Download failed')
      const r2 = await window.kazuki?.instance.create({
        name:name.trim(),mcVersion,loader,minRam,maxRam,
        javaPath:javaPath.trim()||undefined,
        customJvmArgs:jvmArgs.trim()||undefined,
        iconColor,iconText:displayText,iconShape,
      })
      if(!r2?.success) throw new Error(r2?.error||'Create failed')
      setDone(true)
      setTimeout(()=>{onCreated(r2.instance);onClose()},1000)
    }catch(e:any){
      setError(e.message)
      setInstalling(false)
    }
  }

  const STEP_LABELS = ['Customize','Version','Install']

  return (
    <div className={s.overlay} onClick={installing?undefined:onClose}>
      <div className={s.modal} onClick={e=>e.stopPropagation()}>
        <div className={s.topBar}/>

        {/* Header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <div className={s.title}><span className={s.accent}>NEW</span> INSTANCE</div>
            <div className={s.stepRow}>
              {STEP_LABELS.map((l,i)=>(
                <div key={i} className={`${s.stepItem} ${step===i?s.stepActive:''} ${step>i?s.stepDone:''}`}>
                  <div className={s.stepNum}>{step>i?'✓':i+1}</div>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
          {!installing&&<button className={s.xBtn} onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>}
        </div>

        {/* ── STEP 0: Customize ── */}
        {step===0&&(
          <div className={s.body}>
            {/* Icon builder */}
            <div className={s.iconBuilder}>
              <div className={s.iconPreviewWrap}>
                <div className={s.iconPreview} style={{
                  background:iconColor+'20',
                  border:`2px solid ${iconColor}66`,
                  borderRadius:getBorderRadius(iconShape),
                  transform:iconShape==='diamond'?'rotate(45deg)':'none'
                }}>
                  <span style={{
                    color:iconColor,
                    fontFamily:'var(--font-display)',
                    fontWeight:700,fontSize:22,
                    transform:iconShape==='diamond'?'rotate(-45deg)':'none',
                    display:'block'
                  }}>{displayText}</span>
                </div>
                <div className={s.iconPreviewLabel}>Preview</div>
              </div>
              <div className={s.iconControls}>
                <div className={s.fieldLbl}>Color</div>
                <div className={s.colorRow}>
                  {ICON_COLORS.map(c=>(
                    <button key={c} type="button" className={`${s.colorBtn} ${iconColor===c?s.colorActive:''}`}
                      style={{background:c,boxShadow:iconColor===c?`0 0 0 2px #fff, 0 0 0 4px ${c}`:undefined}}
                      onClick={()=>setIconColor(c)}/>
                  ))}
                </div>
                <div className={s.fieldLbl} style={{marginTop:10}}>Shape</div>
                <div className={s.shapeRow}>
                  {ICON_SHAPES.map(sh=>(
                    <button key={sh} type="button" className={`${s.shapeBtn} ${iconShape===sh?s.shapeBtnActive:''}`}
                      onClick={()=>setIconShape(sh)}>
                      <div style={{width:18,height:18,background:iconShape===sh?iconColor:'var(--kz-border2)',borderRadius:getBorderRadius(sh),transform:sh==='diamond'?'rotate(45deg)':'none'}}/>
                    </button>
                  ))}
                </div>
                <div className={s.fieldLbl} style={{marginTop:10}}>Icon Text</div>
                <input className={s.inp} style={{width:80}} maxLength={2} value={iconText}
                  onChange={e=>setIconText(e.target.value.toUpperCase())}
                  placeholder={name.substring(0,2).toUpperCase()||'KZ'}
                  type="text"/>
              </div>
            </div>

            <div className={s.fieldLbl}>Instance Name *</div>
            <input className={`${s.inp} ${nameErr?s.inpErr:''}`} type="text"
              placeholder="My Survival World"
              value={name} onChange={e=>{setName(e.target.value);setNameErr('')}}/>
            {nameErr&&<div className={s.errMsg}>{nameErr}</div>}

            <div className={s.twoCol}>
              <div>
                <div className={s.fieldLbl}>Min RAM</div>
                <div className={s.slRow}>
                  <input type="range" min={256} max={2048} step={256} value={minRam}
                    onChange={e=>setMinRam(+e.target.value)} className={s.slider}/>
                  <span className={s.slVal}>{minRam}M</span>
                </div>
              </div>
              <div>
                <div className={s.fieldLbl}>Max RAM</div>
                <div className={s.slRow}>
                  <input type="range" min={1024} max={16384} step={512} value={maxRam}
                    onChange={e=>setMaxRam(+e.target.value)} className={s.slider}/>
                  <span className={s.slVal}>{Math.round(maxRam/1024)}G</span>
                </div>
              </div>
            </div>

            <div className={s.fieldLbl}>Java Path <span className={s.optional}>(optional — blank = auto detect)</span></div>
            <input className={s.inp} type="text"
              placeholder="C:\Program Files\Eclipse Adoptium\jre-21\bin\javaw.exe"
              value={javaPath} onChange={e=>setJavaPath(e.target.value)}/>

            <div className={s.fieldLbl}>Custom JVM Args <span className={s.optional}>(optional)</span></div>
            <input className={s.inp} type="text"
              placeholder="-XX:+UseZGC -Xss4M"
              value={jvmArgs} onChange={e=>setJvmArgs(e.target.value)}/>

            <div className={s.footer}>
              <button className={s.cancelBtn} type="button" onClick={onClose}>Cancel</button>
              <button className={s.nextBtn} type="button" onClick={()=>{if(validate())setStep(1)}}>
                Next <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2L9 6L3 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Version ── */}
        {step===1&&(
          <div className={s.body}>
            <div className={s.fieldLbl}>Minecraft Version</div>
            <div className={s.verGrid}>
              {MC_VERSIONS.map(v=>(
                <button key={v.id} type="button"
                  className={`${s.verChip} ${mcVersion===v.id?s.verActive:''}`}
                  onClick={()=>setMcVersion(v.id)}>
                  {v.label}
                  {v.tag&&<span className={s.verTag}>{v.tag}</span>}
                </button>
              ))}
            </div>

            <div className={s.fieldLbl} style={{marginTop:18}}>Mod Loader</div>
            <div className={s.loaderRow}>
              {LOADERS.map(l=>(
                <button key={l.id} type="button"
                  className={`${s.loaderCard} ${loader===l.id?s.loaderActive:''}`}
                  onClick={()=>setLoader(l.id)}
                  style={loader===l.id?{borderColor:l.color+'66',background:l.color+'10'}:undefined}>
                  <div className={s.loaderDot} style={{background:l.color}}/>
                  <div>
                    <div className={s.loaderName} style={loader===l.id?{color:l.color}:undefined}>{l.name}</div>
                    <div className={s.loaderDesc}>{l.desc}</div>
                  </div>
                  {loader===l.id&&<div className={s.loaderCheck} style={{color:l.color}}>✓</div>}
                </button>
              ))}
            </div>

            <div className={s.footer}>
              <button className={s.cancelBtn} type="button" onClick={()=>setStep(0)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 2L3 6L9 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> Back
              </button>
              <button className={s.nextBtn} type="button" onClick={()=>setStep(2)}>
                Next <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2L9 6L3 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Install ── */}
        {step===2&&(
          <div className={s.body}>
            {/* Summary card */}
            <div className={s.summary}>
              <div style={{
                width:50,height:50,flexShrink:0,
                background:iconColor+'20',border:`2px solid ${iconColor}66`,
                borderRadius:getBorderRadius(iconShape),
                display:'flex',alignItems:'center',justifyContent:'center',
                transform:iconShape==='diamond'?'rotate(45deg)':'none'
              }}>
                <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:18,color:iconColor,transform:iconShape==='diamond'?'rotate(-45deg)':'none',display:'block'}}>{displayText}</span>
              </div>
              <div>
                <div className={s.sumName}>{name}</div>
                <div className={s.sumMeta}>
                  <span style={{color:'#00b4d8'}}>Java {mcVersion}</span>
                  <span className={s.dot}/>
                  <span style={{color:LOADERS.find(l=>l.id===loader)?.color}}>{loader.toUpperCase()}</span>
                  <span className={s.dot}/>
                  <span>{Math.round(maxRam/1024)}G RAM</span>
                </div>
              </div>
            </div>

            {!installing&&!done&&!error&&(
              <div className={s.notice}>
                Will download Minecraft {mcVersion} client.jar, libraries, and assets (~300-700MB).
                Ensure stable internet connection before proceeding.
              </div>
            )}

            {installing&&!done&&(
              <div className={s.progressWrap}>
                <div className={s.progressInfo}>
                  <span className={s.progressName}>{progress.name||'Starting download...'}</span>
                  <span className={s.progressPct}>{progress.percent}%</span>
                </div>
                <div className={s.track}>
                  <div className={s.fill} style={{width:`${progress.percent}%`}}/>
                  <div className={s.fillGlow} style={{width:`${progress.percent}%`}}/>
                </div>
                <div className={s.progressHint}>Do not close Kazuki Client during installation</div>
              </div>
            )}

            {done&&(
              <div className={s.successBox}>
                <div className={s.successCheck}>✓</div>
                <div className={s.successMsg}>Instance created! Launching...</div>
              </div>
            )}

            {error&&(
              <div className={s.errorBox}>
                <div className={s.errTitle}>Installation Failed</div>
                <div className={s.errDetail}>{error}</div>
                <div className={s.errHint}>Make sure Java 21 is installed and you have internet access.</div>
              </div>
            )}

            <div className={s.footer}>
              {!installing&&!done&&(
                <>
                  <button className={s.cancelBtn} type="button" onClick={()=>setStep(1)}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 2L3 6L9 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> Back
                  </button>
                  <button className={s.installBtn} type="button" onClick={install}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1V9M3 6L7 10L11 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 13H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    Install & Create
                  </button>
                </>
              )}
              {error&&<>
                <button className={s.cancelBtn} type="button" onClick={onClose}>Close</button>
                <button className={s.installBtn} type="button" onClick={()=>{setError('');install()}}>Retry</button>
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

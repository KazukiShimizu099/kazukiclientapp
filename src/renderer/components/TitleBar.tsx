import s from './TitleBar.module.css'
export default function TitleBar() {
  return (
    <div className={s.bar} style={{WebkitAppRegion:'drag'} as any}>
      <div className={s.logoWrap}>
        <img src="logo32.png" className={s.leafIcon} alt=""
          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
        <span className={s.name}>KAZUKI</span>
        <span className={s.sep}>/</span>
        <span className={s.sub}>CLIENT</span>
      </div>
      <div className={s.tag}>v1.0.0</div>
      <div style={{flex:1}}/>
      <div className={s.winBtns} style={{WebkitAppRegion:'no-drag'} as any}>
        <button className={s.wb} onClick={()=>window.kazuki?.window.minimize()}>
          <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="1.5" rx=".75" fill="currentColor"/></svg>
        </button>
        <button className={s.wb} onClick={()=>window.kazuki?.window.maximize()}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x=".5" y=".5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
        <button className={`${s.wb} ${s.closeBtn}`} onClick={()=>window.kazuki?.window.close()}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  )
}

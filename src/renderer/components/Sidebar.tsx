import type { TabId } from '../App'
import type { Account } from '../types'
import s from './Sidebar.module.css'

interface Props {
  activeTab: TabId; onTabChange:(t:TabId)=>void
  account:Account|null; accountCount:number
  onAccountClick:()=>void; onAddAccount:()=>void
}

const NAV_TOP = [
  { id:'home'    as TabId, label:'Home',
    icon:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 6L7.5 1.5L14 6V14H10V9.5H5V14H1V6Z" stroke="currentColor" strokeWidth="1.2"/></svg> },
  { id:'mods'    as TabId, label:'Mods', badge:'NEW',
    icon:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L13 4.5V11L7.5 14.5L2 11V4.5L7.5 1Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/></svg> },
  { id:'hud'     as TabId, label:'HUD Modules',
    icon:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2"/><rect x="2.5" y="2.5" width="4" height="3" rx=".5" stroke="currentColor" strokeWidth=".9"/><rect x="8.5" y="2.5" width="4" height="3" rx=".5" stroke="currentColor" strokeWidth=".9"/><rect x="2.5" y="7.5" width="10" height="1" fill="currentColor" opacity=".35"/></svg> },
  { id:'discord' as TabId, label:'Discord RPC',
    icon:<svg width="15" height="12" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.4a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.6-1.8 3.7a54 54 0 0 0-16.2 0 37.4 37.4 0 0 0-1.8-3.7.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.9 4.9a.2.2 0 0 0-.1.1C1.6 18.1-1 30.9.3 43.5a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 9 .2.2 0 0 0 .2-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.8.6 1.1.9a.2.2 0 0 1 0 .4 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3c1.1 2.1 2.3 4.1 3.6 6a.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 17.8-9 .2.2 0 0 0 .1-.2C73 28.9 69.7 16.2 60.2 5a.2.2 0 0 0-.1-.1z"/></svg> },
]

const NAV_BOT = [
  { id:'settings' as TabId, label:'Settings',
    icon:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7.5 1V3M7.5 12V14M14 7.5H12M3 7.5H1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M12 3L10.5 4.5M4.5 10.5L3 12M12 12L10.5 10.5M4.5 4.5L3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { id:'legal'    as TabId, label:'Legal & Privacy',
    icon:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 1H12V14H3V1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 4H10M5 7H10M5 10H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg> },
]

export default function Sidebar({activeTab,onTabChange,account,accountCount,onAccountClick,onAddAccount}:Props) {
  return (
    <aside className={s.sidebar}>
      <div className={s.accountBlock} onClick={onAccountClick}>
        <div className={s.avatar}>
          <span className={s.avatarTxt}>{account ? account.username.substring(0,2).toUpperCase() : '--'}</span>
          <div className={s.avatarGlow}/>
          {account && <div className={s.onlineDot}/>}
        </div>
        <div className={s.accountInfo}>
          <div className={s.accountName}>{account ? account.username : 'Not logged in'}</div>
          <div className={s.accountMeta}>
            {account ? (account.type==='microsoft'?'Microsoft':'Offline') : 'Click to login'}
            {accountCount > 1 && <span className={s.multiTag}>{accountCount}</span>}
          </div>
        </div>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{color:'var(--t3)',flexShrink:0}}>
          <path d="M2.5 1.5L6 4.5L2.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className={s.navGroup}>
        {NAV_TOP.map(item => (
          <button key={item.id} type="button"
            className={`${s.navItem} ${activeTab===item.id?s.active:''}`}
            onClick={()=>onTabChange(item.id)}>
            <span className={s.navIcon}>{item.icon}</span>
            <span className={s.navLabel}>{item.label}</span>
            {item.badge && <span className={s.badge}>{item.badge}</span>}
            {activeTab===item.id && <div className={s.activeBar}/>}
          </button>
        ))}
      </div>

      <div style={{flex:1}}/>

      <div className={s.navGroup}>
        {NAV_BOT.map(item => (
          <button key={item.id} type="button"
            className={`${s.navItem} ${activeTab===item.id?s.active:''}`}
            onClick={()=>onTabChange(item.id)}>
            <span className={s.navIcon}>{item.icon}</span>
            <span className={s.navLabel}>{item.label}</span>
            {activeTab===item.id && <div className={s.activeBar}/>}
          </button>
        ))}
      </div>

      <div className={s.addAccRow}>
        <button type="button" className={s.addAccBtn} onClick={onAddAccount}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1V10M1 5.5H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Add Account
        </button>
      </div>

      <div className={s.footer}>
        <div className={s.statusRow}>
          <div className={s.statusDot}/>
          <span className={s.statusTxt}>Services online</span>
        </div>
        <div className={s.buildTxt}>Kazuki Client v1.0.0</div>
      </div>
    </aside>
  )
}

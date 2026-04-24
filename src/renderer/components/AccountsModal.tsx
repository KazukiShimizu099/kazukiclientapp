import type { Account } from '../types'
import s from './AccountsModal.module.css'

interface Props {
  accounts: Account[]
  activeAccount: Account | null
  onSwitch: (acc:Account)=>void
  onRemove: (uuid:string)=>void
  onAdd: ()=>void
  onClose: ()=>void
}

export default function AccountsModal({accounts,activeAccount,onSwitch,onRemove,onAdd,onClose}:Props) {
  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e=>e.stopPropagation()}>
        <div className={s.topGlow}/>

        <div className={s.header}>
          <div className={s.title}>ACCOUNTS</div>
          <button className={s.xBtn} type="button" onClick={onClose} title="Close">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>

        <div className={s.list}>
          {accounts.length===0&&(
            <div className={s.empty}>
              <div className={s.emptyIcon}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="9" r="5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M4 25C4 20.582 8.477 17 14 17C19.523 17 24 20.582 24 25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </div>
              <div className={s.emptyText}>No accounts yet</div>
            </div>
          )}
          {accounts.map(acc=>{
            const isActive = acc.uuid===activeAccount?.uuid
            const initials = acc.username.substring(0,2).toUpperCase()
            return (
              <div key={acc.uuid} className={`${s.item} ${isActive?s.itemActive:''}`}
                onClick={()=>onSwitch(acc)}>
                {isActive&&<div className={s.activeBar}/>}
                <div className={s.avatar} style={isActive?{borderColor:'rgba(0,180,216,0.5)'}:undefined}>
                  <span className={s.avatarText} style={isActive?{color:'var(--kz-accent)'}:undefined}>{initials}</span>
                  {isActive&&<div className={s.onlineDot}/>}
                </div>
                <div className={s.info}>
                  <div className={s.name}>{acc.username}</div>
                  <div className={s.type}>
                    <span className={s.typeDot} style={{background:acc.type==='microsoft'?'#00b4d8':'#f0b429'}}/>
                    {acc.type==='microsoft'?'Microsoft Account':'Offline / Cracked'}
                  </div>
                </div>
                {isActive&&<div className={s.activeBadge}>Active</div>}
                <button
                  className={s.removeBtn}
                  type="button"
                  title="Remove account"
                  onClick={e=>{e.stopPropagation();if(window.confirm(`Remove "${acc.username}"?`))onRemove(acc.uuid)}}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>

        <div className={s.footer}>
          <button className={s.addBtn} type="button" onClick={onAdd}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add Account
          </button>
          <div className={s.footInfo}>{accounts.length} account{accounts.length!==1?'s':''} saved</div>
        </div>
      </div>
    </div>
  )
}

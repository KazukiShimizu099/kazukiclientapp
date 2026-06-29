import s from './Sidebar.module.css'

interface Props {
  activeTab: string
  onTabChange: (t: any) => void
  account?: any
  accountCount?: number
  onAccountClick?: () => void
  onAddAccount?: () => void
}

export default function Sidebar({ activeTab, onTabChange, account, accountCount, onAccountClick, onAddAccount }: Props) {
  const navItems = [
    { id: 'home', icon: '⌂', label: 'Dashboard' },
    { id: 'mods', icon: '⌘', label: 'Mod Manager' },
    { id: 'hud', icon: '◧', label: 'HUD Editor' },
    { id: 'settings', icon: '⚙', label: 'Settings' }
  ]

  return (
    <div className={s.sidebar}>
      <div className={s.brand}>
        <div className={s.logo}>K</div>
        <div className={s.name}>KAZUKI</div>
      </div>
      
      <div className={s.nav}>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`${s.navBtn} ${activeTab === item.id ? s.active : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className={s.icon}>{item.icon}</span>
            <span className={s.label}>{item.label}</span>
          </button>
        ))}
      </div>

      <div className={s.footer}>
        {/* Account Switcher Section */}
        <div className={s.accountBox} onClick={onAccountClick}>
          {account ? (
            <>
              <img src={`https://minotar.net/helm/${account.username}/32`} alt="Skin" className={s.avatar} />
              <div className={s.accInfo}>
                <div className={s.accName}>{account.username}</div>
                <div className={s.accType}>{account.type === 'microsoft' ? 'Microsoft' : 'Offline'}</div>
              </div>
            </>
          ) : (
            <div className={s.noAcc}>+ Login / Add Account</div>
          )}
        </div>
        <div className={s.version}>v1.0.0 Alpha</div>
      </div>
    </div>
  )
}
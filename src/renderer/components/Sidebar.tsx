import s from './Sidebar.module.css'

interface Props {
  activeTab: string
  setActiveTab: (t: string) => void
}

export default function Sidebar({ activeTab, setActiveTab }: Props) {
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
            onClick={() => setActiveTab(item.id)}
          >
            <span className={s.icon}>{item.icon}</span>
            <span className={s.label}>{item.label}</span>
          </button>
        ))}
      </div>

      <div className={s.footer}>
        <div className={s.version}>v1.0.0 Alpha</div>
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import ModsPage from './pages/ModsPage'
import HudPage from './pages/HudPage'
import SettingsPage from './pages/SettingsPage'
import DiscordPage from './pages/DiscordPage'
import LegalPage from './pages/LegalPage'
import AuthModal from './components/AuthModal'
import AccountsModal from './components/AccountsModal'
import type { Account } from './types'

export type TabId = 'home' | 'mods' | 'hud' | 'discord' | 'settings' | 'legal'
declare global { interface Window { kazuki: any } }

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccount, setActiveAccount] = useState<Account | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const saved = (await window.kazuki?.settings.get())?.settings?.accounts || []
      const active = await window.kazuki?.auth.getAccount()
      setAccounts(saved)
      setActiveAccount(active)
      if (!active) setShowAuth(true)
      setLoading(false)
    }
    init()
  }, [])

  async function handleAddAccount(acc: Account) {
    const next = [...accounts.filter(a => a.uuid !== acc.uuid), acc]
    setAccounts(next)
    setActiveAccount(acc)
    await window.kazuki?.settings.set('accounts', next)
    setShowAuth(false)
    window.kazuki?.discord.setConfig?.({ state: `Logged in as ${acc.username}` })
  }

  async function handleSwitchAccount(acc: Account) {
    setActiveAccount(acc)
    window.kazuki?.settings.set('activeAccount', acc)
    setShowAccounts(false)
  }

  async function handleRemoveAccount(uuid: string) {
    const next = accounts.filter(a => a.uuid !== uuid)
    setAccounts(next)
    if (activeAccount?.uuid === uuid) setActiveAccount(next[0] || null)
    window.kazuki?.settings.set('accounts', next)
  }

  if (loading) return (
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',background:'var(--void)',gap:20}}>
      <img src="logo.png" style={{width:72,height:72,objectFit:'contain',animation:'leafGlow 2s ease-in-out infinite'}} alt=""
        onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
      <div style={{fontFamily:'var(--disp)',fontSize:38,fontWeight:700,letterSpacing:8,color:'var(--t1)',animation:'fadeIn .5s ease'}}>
        KAZ<span style={{color:'var(--leaf)'}}>UKI</span>
      </div>
      <div style={{width:180,height:2,background:'rgba(255,255,255,.06)',borderRadius:1,overflow:'hidden'}}>
        <div style={{height:'100%',background:'linear-gradient(90deg,var(--leaf),var(--purple))',animation:'shimmer 1.2s linear infinite',backgroundSize:'200% 100%'}}/>
      </div>
      <div style={{fontSize:11,color:'var(--t3)',letterSpacing:4,fontFamily:'var(--mono)'}}>LOADING</div>
    </div>
  )

  return (
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',position:'relative',zIndex:1}}>
      <TitleBar/>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <Sidebar
          activeTab={tab} onTabChange={setTab}
          account={activeAccount} accountCount={accounts.length}
          onAccountClick={() => accounts.length > 0 ? setShowAccounts(true) : setShowAuth(true)}
          onAddAccount={() => setShowAuth(true)}
        />
        <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {tab === 'home'     && <HomePage account={activeAccount}/>}
          {tab === 'mods'     && <ModsPage/>}
          {tab === 'hud'      && <HudPage/>}
          {tab === 'discord'  && <DiscordPage/>}
          {tab === 'settings' && <SettingsPage/>}
          {tab === 'legal'    && <LegalPage/>}
        </main>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={handleAddAccount}/>}
      {showAccounts && (
        <AccountsModal
          accounts={accounts} activeAccount={activeAccount}
          onSwitch={handleSwitchAccount} onRemove={handleRemoveAccount}
          onAdd={() => { setShowAccounts(false); setShowAuth(true) }}
          onClose={() => setShowAccounts(false)}
        />
      )}
    </div>
  )
}

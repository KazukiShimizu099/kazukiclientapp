import { useState } from 'react'
import type { Account } from '../types'
import s from './AuthModal.module.css'

interface Props { onClose:()=>void; onAuth:(acc:Account)=>void }

type Step = 'select' | 'offline' | 'ms-code' | 'ms-polling'

export default function AuthModal({onClose,onAuth}:Props) {
  const [step,setStep] = useState<Step>('select')
  const [username,setUsername] = useState('')
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const [deviceInfo,setDeviceInfo] = useState<any>(null)
  const [pollData,setPollData] = useState<any>(null)

  async function startMs() {
    setLoading(true); setError('')
    try {
      const r = await window.kazuki?.auth.microsoftStart()
      if (!r?.success) throw new Error(r?.error||'Failed to start')
      setDeviceInfo(r.info)
      setPollData(r.info)
      setStep('ms-code')
    } catch(e:any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function startPolling() {
    if (!pollData) return
    setStep('ms-polling'); setLoading(true); setError('')
    try {
      const r = await window.kazuki?.auth.microsoftPoll({
        device_code: pollData.device_code,
        interval:    pollData.interval||5
      })
      if (r?.success) { onAuth(r.account) }
      else throw new Error(r?.error||'Login failed')
    } catch(e:any) { setError(e.message); setStep('ms-code') }
    finally { setLoading(false) }
  }

  async function offlineLogin() {
    if (!username.trim()) { setError('Enter a username'); return }
    setLoading(true); setError('')
    try {
      const r = await window.kazuki?.auth.offlineLogin(username.trim())
      if (r?.success) onAuth(r.account)
      else throw new Error(r?.error||'Login failed')
    } catch(e:any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className={s.overlay} onClick={!loading?onClose:undefined}>
      <div className={s.modal} onClick={e=>e.stopPropagation()}>
        <div className={s.topGlow}/>

        {/* Exit button - always visible */}
        <button className={s.exitBtn} type="button" onClick={onClose} title="Close" disabled={loading}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>

        <div className={s.header}>
          <img src="logo32.png" className={s.logo} alt=""
            onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
          <div>
            <div className={s.title}>KAZUKI CLIENT</div>
            <div className={s.subtitle}>Sign in to continue</div>
          </div>
        </div>

        {/* SELECT */}
        {step==='select' && (
          <div className={s.body}>
            <button className={`${s.authBtn} ${s.msBtn}`} type="button"
              onClick={startMs} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <rect x="0" y="0" width="8.5" height="8.5" fill="#f25022"/>
                <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7fba00"/>
                <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00a4ef"/>
                <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#ffb900"/>
              </svg>
              <span>Microsoft Account</span>
              <span className={s.tag}>Premium</span>
            </button>

            <div className={s.divider}><span/>or<span/></div>

            <button className={`${s.authBtn} ${s.offBtn}`} type="button"
              onClick={()=>setStep('offline')}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 17C2 13.134 5.134 10 9 10C12.866 10 16 13.134 16 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span>Offline Mode</span>
              <span className={s.tag}>Custom name</span>
            </button>
            {error && <div className={s.err}>{error}</div>}
          </div>
        )}

        {/* OFFLINE */}
        {step==='offline' && (
          <div className={s.body}>
            <div className={s.fieldLabel}>Username</div>
            <input className={s.inp} type="text" autoFocus maxLength={16}
              placeholder="YourUsername (3-16 chars)"
              value={username} onChange={e=>setUsername(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&offlineLogin()}/>
            <div className={s.hint}>Letters, numbers, underscores only. No spaces.</div>
            {error && <div className={s.err}>{error}</div>}
            <div className={s.btnRow}>
              <button className={s.backBtn} type="button" onClick={()=>{setStep('select');setError('')}}>Back</button>
              <button className={s.confirmBtn} type="button" onClick={offlineLogin} disabled={loading}>
                {loading?'Logging in...':'Play Offline'}
              </button>
            </div>
          </div>
        )}

        {/* MS CODE */}
        {step==='ms-code' && deviceInfo && (
          <div className={s.body}>
            <div className={s.codeBox}>
              <div className={s.codeLabel}>Open this in your browser:</div>
              <div className={s.codeUrl}>{deviceInfo.verification_uri}</div>
              <div className={s.codeLabel} style={{marginTop:12}}>Enter this code:</div>
              <div className={s.code}>{deviceInfo.user_code}</div>
              <div className={s.codeHint}>Browser opened automatically. Enter the code there, then click Continue below.</div>
            </div>
            {error && <div className={s.err}>{error}</div>}
            <div className={s.btnRow}>
              <button className={s.backBtn} type="button" onClick={()=>{setStep('select');setError('')}}>Back</button>
              <button className={s.confirmBtn} type="button" onClick={startPolling} disabled={loading}>
                {loading?'Waiting...':'I Entered the Code →'}
              </button>
            </div>
          </div>
        )}

        {/* POLLING */}
        {step==='ms-polling' && (
          <div className={s.body}>
            <div className={s.pendingBox}>
              <div className={s.spinner}/>
              <div className={s.pendingTitle}>Waiting for Microsoft...</div>
              <div className={s.pendingText}>Complete sign-in in your browser. This may take 30-60 seconds.</div>
            </div>
            {error && <div className={s.err}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

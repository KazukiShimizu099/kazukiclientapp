import { useState } from 'react'
import s from './LegalPage.module.css'

type Tab = 'privacy' | 'terms' | 'licenses'

export default function LegalPage() {
  const [tab, setTab] = useState<Tab>('terms')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'terms',    label: 'Terms of Use' },
    { id: 'privacy',  label: 'Privacy Policy' },
    { id: 'licenses', label: 'Open Source' },
  ]

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.title}><span className={s.accent}>LEGAL</span> & POLICY</div>
      </div>

      <div className={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} type="button"
            className={`${s.tab} ${tab === t.id ? s.tabActive : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={s.content}>
        {tab === 'terms' && (
          <div className={s.doc}>
            <h2>Terms of Use</h2>
            <p className={s.updated}>Last updated: April 2026</p>

            <h3>1. Acceptance</h3>
            <p>By using Kazuki Client ("the Client"), you agree to these terms. If you disagree, do not use the Client.</p>

            <h3>2. License</h3>
            <p>Kazuki Client is provided for personal, non-commercial use. You may not redistribute, sell, or claim ownership of this software.</p>

            <h3>3. Minecraft & Mojang</h3>
            <p>Kazuki Client is a third-party launcher for Minecraft Java Edition. It is not affiliated with, endorsed by, or connected to Mojang Studios or Microsoft. You must own a legitimate copy of Minecraft Java Edition to use premium features.</p>

            <h3>4. Offline / Cracked Mode</h3>
            <p>Offline mode is provided for local single-player testing only. Using it to bypass Minecraft's authentication to access multiplayer servers may violate Mojang's EULA and/or server rules. The developers of Kazuki Client are not responsible for misuse.</p>

            <h3>5. No Warranty</h3>
            <p>The Client is provided "as is" without warranty of any kind. We are not liable for any damages arising from use of this software, including data loss, game bans, or system issues.</p>

            <h3>6. Modifications</h3>
            <p>We reserve the right to update these terms at any time. Continued use of the Client constitutes acceptance of updated terms.</p>

            <h3>7. Contact</h3>
            <p>For questions, contact us via the Discord server linked in the Discord RPC settings.</p>
          </div>
        )}

        {tab === 'privacy' && (
          <div className={s.doc}>
            <h2>Privacy Policy</h2>
            <p className={s.updated}>Last updated: April 2026</p>

            <h3>What We Collect</h3>
            <p>Kazuki Client collects minimal data to function:</p>
            <ul>
              <li><strong>Microsoft Account tokens</strong> — stored locally on your device only, used for Minecraft authentication. Never sent to our servers.</li>
              <li><strong>Instance settings</strong> — stored locally in %AppData%\.kazuki\</li>
              <li><strong>Anonymous crash reports</strong> — only if you enable "Send Crash Reports" in Settings. Contains error messages and system specs, no personal info.</li>
            </ul>

            <h3>What We Do NOT Collect</h3>
            <ul>
              <li>No personal identifying information</li>
              <li>No gameplay data or session recordings</li>
              <li>No location data</li>
              <li>No advertising IDs</li>
              <li>No data is sold to third parties</li>
            </ul>

            <h3>Third-Party Services</h3>
            <ul>
              <li><strong>Mojang API</strong> — for version manifests and authentication</li>
              <li><strong>Modrinth API</strong> — for mod browsing (no account required)</li>
              <li><strong>Discord RPC</strong> — local IPC connection only, no data sent to us</li>
            </ul>

            <h3>Data Storage</h3>
            <p>All data is stored locally on your device at <code>%AppData%\.kazuki\</code>. You can delete this folder at any time to remove all stored data.</p>

            <h3>Children's Privacy</h3>
            <p>Kazuki Client does not knowingly collect data from children under 13. If you are under 13, please use the Client with parental supervision.</p>
          </div>
        )}

        {tab === 'licenses' && (
          <div className={s.doc}>
            <h2>Open Source Licenses</h2>
            <p>Kazuki Client is built with the following open source software:</p>

            <div className={s.licenseItem}>
              <div className={s.licName}>Electron</div>
              <div className={s.licLicense}>MIT License — Copyright (c) OpenJS Foundation</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>React</div>
              <div className={s.licLicense}>MIT License — Copyright (c) Meta Platforms, Inc.</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>electron-vite</div>
              <div className={s.licLicense}>MIT License</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>@azure/msal-node</div>
              <div className={s.licLicense}>MIT License — Copyright (c) Microsoft Corporation</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>axios</div>
              <div className={s.licLicense}>MIT License — Copyright (c) Matt Zabriskie</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>adm-zip</div>
              <div className={s.licLicense}>MIT License</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>fs-extra</div>
              <div className={s.licLicense}>MIT License — Copyright (c) JP Richardson</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>electron-store</div>
              <div className={s.licLicense}>MIT License — Copyright (c) Sindre Sorhus</div>
            </div>
            <div className={s.licenseItem}>
              <div className={s.licName}>Modrinth API</div>
              <div className={s.licLicense}>Used under Modrinth's public API terms</div>
            </div>

            <p style={{marginTop:16,fontSize:12,color:'var(--t3)'}}>
              Full license texts available on each project's respective GitHub repository.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

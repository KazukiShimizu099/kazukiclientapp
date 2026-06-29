import { IpcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'

export function setupVersionHandlers(ipcMain: IpcMain, store: Store) {
    ipcMain.handle('versions:get-list', async () => {
        try {
            const res = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 7000 });
            const versions: string[] = [];
            let stop = false;
            
            // Loop through Mojang versions, keep only releases, stop at 1.8
            for (const v of res.data.versions) {
                if (v.type === 'release' && !stop) {
                    versions.push(v.id);
                    if (v.id === '1.8') stop = true;
                }
            }
            return { success: true, versions };
        } catch (error: any) {
            console.error('Failed to fetch Mojang versions:', error.message);
            // Fallback list strictly in case user is entirely offline
            return { success: true, versions: ['1.21.1', '1.20.6', '1.20.4', '1.19.4', '1.18.2', '1.16.5', '1.8.9'] };
        }
    });

    ipcMain.handle('versions:install', async (_, versionId) => {
        store.set(`installed.${versionId}`, { actualId: versionId, installedAt: Date.now() });
        return { success: true };
    });
}
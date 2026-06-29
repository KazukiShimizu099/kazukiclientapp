import { Client } from 'discord-rpc';
import { IpcMain } from 'electron';

const CLIENT_ID = '1521010841774981160';

export class KazukiRPCManager {
    private client: Client | null = null;
    public isReady: boolean = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.connect();
    }

    public async connect() {
        if (this.client) {
            try { await this.client.destroy(); } catch (e) {}
            this.client = null;
        }

        this.isReady = false;
        this.client = new Client({ transport: 'ipc' });

        this.client.on('ready', () => {
            this.isReady = true;
            console.log('SUCCESS: Discord RPC connected automatically.');
            this.updateActivity('Kazuki Client', 'In Launcher');
            
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        });

        this.client.on('error', (err) => {
            console.error('RPC Error:', err.message);
            this.scheduleReconnect();
        });

        try {
            await this.client.login({ clientId: CLIENT_ID });
        } catch (err) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) return;
        this.isReady = false;
        console.log('Auto-reconnecting to Discord in 15s...');
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, 15000);
    }

    public updateActivity(details: string, state: string) {
        if (!this.isReady || !this.client) return;

        this.client.setActivity({
            details: details,
            state: state,
            startTimestamp: Date.now(),
            largeImageKey: 'kazuki_logo',
            largeImageText: 'Kazuki Client',
            smallImageKey: 'minecraft',
            smallImageText: 'Minecraft',
            instance: false,
            buttons: [
                { label: "Get Kazuki Client", url: "https://github.com/" },
                { label: "Discord Server", url: "https://discord.gg/T3AEpEjA9m" }
            ]
        }).catch(() => { /* Silent fail to prevent crash */ });
    }

    public destroy() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.client) {
            this.client.destroy().catch(() => {});
            this.client = null;
        }
        this.isReady = false;
    }
}

export const rpcManager = new KazukiRPCManager();

export function setupDiscordHandlers(ipcMain: IpcMain) {
    ipcMain.handle('discord:get-config', () => ({
        success: true,
        config: { enabled: true, details: 'Kazuki Client', state: 'Launcher' }
    }));

    ipcMain.handle('discord:set-config', (_, cfg) => {
        rpcManager.updateActivity(cfg.details || 'Kazuki Client', cfg.state);
        return { success: true };
    });

    ipcMain.handle('discord:set-state', (_, { state, details }) => {
        rpcManager.updateActivity(details, state);
        return { success: true };
    });

    ipcMain.handle('discord:reconnect', async () => {
        if (!rpcManager.isReady) await rpcManager.connect();
        return { success: rpcManager.isReady };
    });

    ipcMain.handle('discord:get-status', () => ({
        connected: rpcManager.isReady,
        clientId: CLIENT_ID
    }));
}
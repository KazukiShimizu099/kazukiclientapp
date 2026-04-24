import { Client } from 'discord-rpc';
import { IpcMain } from 'electron';

const CLIENT_ID = '1495443956232618064';

class KazukiRPCManager {
    private client: Client | null = null;
    public isReady: boolean = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.connect();
    }

    public async connect() {
        // Purana client saaf karo agar hai toh
        if (this.client) {
            try { await this.client.destroy(); } catch (e) {}
            this.client = null;
        }

        this.isReady = false;
        this.client = new Client({ transport: 'ipc' });

        this.client.on('ready', () => {
            this.isReady = true;
            console.log('SUCCESS: Discord RPC connected automatically.');
            this.updateActivity('Kazuki Client v1.0', 'In Launcher');
            
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
                { label: "Get Kazuki Client", url: "https://github.com/kazuki-client" },
                { label: "Discord Server", url: "https://discord.gg/kazuki" }
            ]
        }).catch(() => { /* Silent fail to prevent crash */ });
    }
}

const rpcManager = new KazukiRPCManager();

export function setupDiscordHandlers(ipcMain: IpcMain) {
    // UI ke errors fix karne ke liye saare handlers
    ipcMain.handle('discord:get-config', () => ({
        success: true,
        config: { enabled: true, details: 'Kazuki Client', state: 'Launcher' }
    }));

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
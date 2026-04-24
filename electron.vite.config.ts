// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Agar externalizeDepsPlugin se kaam nahi banta, toh manually add karo:
        external: ['discord-rpc']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // Renderer settings...
  }
})
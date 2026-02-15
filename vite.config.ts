import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB to match sqlite3.wasm size and monaco workers
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,jpg}']
      }
    })
  ],
  server: {
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }
  },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] }
})

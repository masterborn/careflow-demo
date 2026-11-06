import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { careflowApi } from './server/api.ts'

export default defineConfig({
  plugins: [react(), careflowApi()],
  server: {
    port: 5173,
    strictPort: true,
    // The mock "database" lives in data/; don't reload the page when it changes.
    watch: { ignored: ['**/data/**', '**/screenshots/**'] },
  },
})

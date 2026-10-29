import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { firebaseSwPlugin } from './src/plugins/firebaseSwPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), firebaseSwPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
})

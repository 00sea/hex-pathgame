// client/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow connections from network
    proxy: {
      // Proxy Socket.io and API requests to backend
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true, // Enable WebSocket proxying
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    // Make sure environment variables are available
    'process.env': process.env
  }
})
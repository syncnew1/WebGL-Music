import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    proxy: {
      '/lrc': {
        target: 'https://api.lrc.cx',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lrc/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-three': ['three'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
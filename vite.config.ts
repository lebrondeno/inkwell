import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor'
            }
            if (id.includes('@tiptap/react') || id.includes('@tiptap/starter-kit') || id.includes('@tiptap/pm')) {
              return 'editor'
            }
            if (id.includes('@tiptap/extension-')) {
              return 'tiptap-extensions'
            }
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase'
            }
            if (id.includes('date-fns') || id.includes('lucide-react')) {
              return 'utils'
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})

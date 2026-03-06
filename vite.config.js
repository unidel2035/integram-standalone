import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [PrimeVueResolver()]
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5174,
    allowedHosts: ['fst.drondoc.ru', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
        ws: true
      },
      '/wsclaude': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
        ws: true
      }
    }
  }
})

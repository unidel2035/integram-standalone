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
  },
  optimizeDeps: {
    include: [
      'vue-virtual-scroller',
      'primevue/checkbox',
      'primevue/password',
      'primevue/inputswitch',
      'primevue/toast',
      'primevue/progressspinner',
    ]
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/**/*.{js,vue}',
        'src/components/fst-committee/*.js',
        'src/services/*.js'
      ],
      exclude: [
        'node_modules/',
        'tests/',
        'e2e/',
        'src/**/*.spec.js',
        'src/**/*.test.js'
      ],
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  }
})

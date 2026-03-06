// Stale chunk auto-recovery
window.addEventListener('vite:preloadError', (event) => {
  const GUARD_KEY = '__stale_chunk_reload'
  const now = Date.now()
  const lastReload = Number(sessionStorage.getItem(GUARD_KEY) || 0)
  if (now - lastReload > 30000) {
    sessionStorage.setItem(GUARD_KEY, String(now))
    event.preventDefault()
    window.location.reload()
  }
})

import './devtools-stub.js'
import { initEnvPolyfills } from '@/utils/envPolyfill.js'
initEnvPolyfills()

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import 'primeicons/primeicons.css'
import '@/assets/styles.scss'

import { setupIconify } from '@/plugins/iconify'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: { darkModeSelector: '.app-dark' }
  }
})
app.use(ToastService)
app.use(ConfirmationService)
app.use(DialogService)

setupIconify()
app.mount('#app')

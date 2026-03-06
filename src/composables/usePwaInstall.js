/**
 * usePwaInstall — Vue composable for PWA install prompt handling (Issue #7230)
 *
 * Usage in component:
 * const { canInstall, isInstalled, promptInstall } = usePwaInstall()
 */

import { ref, onMounted, onUnmounted } from 'vue'

export function usePwaInstall() {
  const canInstall = ref(false)
  const isInstalled = ref(false)
  let deferredPrompt = null

  const handleBeforeInstall = (e) => {
    e.preventDefault()
    deferredPrompt = e
    canInstall.value = true
  }

  const handleAppInstalled = () => {
    canInstall.value = false
    isInstalled.value = true
    deferredPrompt = null
  }

  onMounted(() => {
    // Check if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    window.removeEventListener('appinstalled', handleAppInstalled)
  })

  const promptInstall = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    canInstall.value = false
    return outcome === 'accepted'
  }

  return { canInstall, isInstalled, promptInstall }
}

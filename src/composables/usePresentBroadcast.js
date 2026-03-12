/**
 * usePresentBroadcast
 *
 * Слушает BroadcastChannel 'fst-present' (instant, same browser)
 * и полит GET /api/events/session/present-live каждые 2 секунды
 * для синхронизации через Integram (cross-browser, cross-account).
 *
 * Подключается в AppLayout — работает в «чистом» окне Пескова.
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoleStore } from '@/stores/roleStore'

const SESSION_ID = 'present-live'

export function usePresentBroadcast() {
  const router = useRouter()
  const roleStore = useRoleStore()
  const isPresentDisplay = ref(false)
  const lastStepTs = ref(0)
  let bc = null
  let pollTimer = null

  function handleNavigate(route) {
    // Ведущий (роль present) управляет сам — не автоследуем за событиями
    if (roleStore.activeRole === 'present') return
    // Если уже на странице телесуфлёра — не уходим
    if (router.currentRoute.value.path === '/fst-present') return
    isPresentDisplay.value = true
    router.push(route)
  }

  // BroadcastChannel — instant (same browser tabs)
  function setupBroadcast() {
    try {
      bc = new BroadcastChannel('fst-present')
      bc.onmessage = (e) => {
        if (e.data.type === 'PRESENT_STEP' && e.data.route) {
          handleNavigate(e.data.route)
        }
        if (e.data.type === 'stop') {
          isPresentDisplay.value = false
        }
      }
    } catch {}
  }

  // Polling — cross-browser/cross-account (Gordin → Peskov)
  async function pollEvents() {
    try {
      const res = await fetch(`/api/events/session/${SESSION_ID}`)
      if (!res.ok) return
      const events = await res.json()
      if (!Array.isArray(events) || !events.length) return

      // Find last PRESENT_STEP event
      const steps = events
        .filter(e => e.type === 'PRESENT_STEP')
        .sort((a, b) => b.ts - a.ts)

      if (!steps.length) return
      const latest = steps[0]

      // Only navigate if this is a newer event than what we last processed
      if (latest.ts > lastStepTs.value && latest.data?.route) {
        lastStepTs.value = latest.ts
        handleNavigate(latest.data.route)
      }

      // Check for PRESENT_STOPPED (newer than last step we handled)
      const stopped = events
        .filter(e => e.type === 'PRESENT_STOPPED')
        .sort((a, b) => b.ts - a.ts)[0]
      if (stopped && stopped.ts > lastStepTs.value) {
        isPresentDisplay.value = false
      }
    } catch {}
  }

  onMounted(() => {
    setupBroadcast()
    // Poll every 2 seconds for cross-account sync
    pollTimer = setInterval(pollEvents, 2000)
  })

  onUnmounted(() => {
    try { if (bc) { bc.close(); bc = null } } catch {}
    if (pollTimer) clearInterval(pollTimer)
  })

  return { isPresentDisplay }
}

/**
 * useOfflineStatus — Vue composable для отображения статуса офлайн-синхронизации
 *
 * Использование в компоненте:
 * const { isOnline, isSyncing, pendingCount, syncStatus } = useOfflineStatus()
 */

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { offlineSync } from '@/services/offlineSync'

export function useOfflineStatus() {
  const isOnline = ref(offlineSync.isOnline)
  const isSyncing = ref(false)
  const pendingCount = ref(offlineSync.pendingCount)
  const lastSyncedAt = ref(null)

  const syncStatus = computed(() => {
    if (!isOnline.value) return 'offline'
    if (isSyncing.value) return 'syncing'
    if (pendingCount.value > 0) return 'pending'
    return 'synced'
  })

  const syncStatusLabel = computed(() => {
    switch (syncStatus.value) {
      case 'offline': return 'Офлайн'
      case 'syncing': return 'Синхронизация...'
      case 'pending': return `Ожидает синхронизации (${pendingCount.value})`
      case 'synced': return 'Сохранено'
      default: return ''
    }
  })

  const syncStatusIcon = computed(() => {
    switch (syncStatus.value) {
      case 'offline': return 'pi pi-wifi-off'
      case 'syncing': return 'pi pi-spin pi-sync'
      case 'pending': return 'pi pi-clock'
      case 'synced': return 'pi pi-check'
      default: return ''
    }
  })

  const unsubscribers = []

  onMounted(() => {
    unsubscribers.push(
      offlineSync.on('online', () => { isOnline.value = true }),
      offlineSync.on('offline', () => { isOnline.value = false }),
      offlineSync.on('sync-started', () => { isSyncing.value = true }),
      offlineSync.on('sync-completed', ({ synced }) => {
        isSyncing.value = false
        if (synced > 0) lastSyncedAt.value = new Date()
      }),
      offlineSync.on('pending-changed', ({ count }) => {
        pendingCount.value = count
      }),
    )
  })

  onUnmounted(() => {
    unsubscribers.forEach((unsub) => unsub?.())
  })

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    syncStatus,
    syncStatusLabel,
    syncStatusIcon,
    // Принудительная синхронизация
    forceSync: () => offlineSync.flush(),
    // Список локально сохранённых документов
    listLocalDocs: () => offlineSync.listLocal(),
  }
}

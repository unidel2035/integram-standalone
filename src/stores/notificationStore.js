/**
 * Notification Store — уведомления о проектах требующих внимания.
 *
 * Источники уведомлений:
 * - Проект застрял на этапе > N дней (нет событий)
 * - Term Sheet предложен, но сделка не закрыта > 7 дней
 * - Критический флаг от факторной оценки (sovereign < 0.4)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useEventStore } from '@/stores/eventStore.js'

const STALE_DAYS    = 14   // дней без активности — "застрял"
const DEAL_DAYS     = 7    // дней после Term Sheet без закрытия сделки
const MS_IN_DAY     = 86_400_000

export const useNotificationStore = defineStore('notifications', () => {
  const eventStore = useEventStore()
  const dismissed  = ref(new Set(JSON.parse(localStorage.getItem('fst_dismissed_notifs') || '[]')))

  function dismiss(id) {
    dismissed.value.add(id)
    localStorage.setItem('fst_dismissed_notifs', JSON.stringify([...dismissed.value]))
  }

  function clearAll() {
    dismissed.value = new Set()
    localStorage.removeItem('fst_dismissed_notifs')
  }

  const notifications = computed(() => {
    const now    = Date.now()
    const result = []

    // Собираем все сущности которые есть в eventStore
    const dealIds    = eventStore.getIds?.('deal')    || []
    const projectIds = eventStore.getIds?.('project') || []
    const allIds     = [...new Set([...dealIds, ...projectIds])]

    for (const id of allIds) {
      const dealEvents    = eventStore.getTimeline('deal',    id)
      const projectEvents = eventStore.getTimeline('project', id)
      const all = [...dealEvents, ...projectEvents].sort((a, b) => b.ts - a.ts)
      if (!all.length) continue

      const name    = all[0]?.data?.company || all[0]?.data?.projectName || id
      const lastTs  = all[0].ts
      const daysSince = (now - lastTs) / MS_IN_DAY

      // 1. Застрял (нет активности > STALE_DAYS)
      const stalId = `stale-${id}`
      if (daysSince > STALE_DAYS && !dismissed.value.has(stalId)) {
        result.push({
          id:       stalId,
          type:     'stale',
          severity: 'warn',
          icon:     'pi pi-clock',
          title:    name,
          message:  `Нет активности ${Math.round(daysSince)} дней`,
          action:   { label: 'Открыть', route: '/fst-project/' + id },
          ts:       lastTs,
        })
      }

      // 2. Term Sheet предложен, но DEAL_CLOSED нет > DEAL_DAYS
      const tsProposed = dealEvents.find(e => e.type === 'TERM_SHEET_PROPOSED')
      const dealClosed = dealEvents.find(e => e.type === 'DEAL_CLOSED')
      if (tsProposed && !dealClosed) {
        const daysAfterTs = (now - tsProposed.ts) / MS_IN_DAY
        const nid = `ts-pending-${id}`
        if (daysAfterTs > DEAL_DAYS && !dismissed.value.has(nid)) {
          result.push({
            id:       nid,
            type:     'deal_pending',
            severity: 'warn',
            icon:     'pi pi-file-edit',
            title:    name,
            message:  `Term Sheet предложен ${Math.round(daysAfterTs)} дн. назад, сделка не закрыта`,
            action:   { label: 'Сделка', route: '/fst-deal' },
            ts:       tsProposed.ts,
          })
        }
      }

      // 3. Красный флаг суверенности из FACTOR_SCORED
      const factorEvt = [...dealEvents, ...projectEvents].find(e => e.type === 'FACTOR_SCORED')
      if (factorEvt?.data?.redFlags?.length) {
        const nid = `factor-flags-${id}`
        if (!dismissed.value.has(nid)) {
          result.push({
            id:       nid,
            type:     'factor_flags',
            severity: 'danger',
            icon:     'pi pi-exclamation-triangle',
            title:    name,
            message:  `Красные флаги: ${factorEvt.data.redFlags.slice(0, 2).join('; ')}`,
            action:   { label: 'Факторы', route: '/fst-project/' + id },
            ts:       factorEvt.ts,
          })
        }
      }
    }

    // Сортируем: danger → warn, потом по времени
    return result.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1
      return b.ts - a.ts
    })
  })

  const unreadCount = computed(() => notifications.value.length)

  return { notifications, unreadCount, dismiss, clearAll }
})

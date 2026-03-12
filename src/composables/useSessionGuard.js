/**
 * useSessionGuard — реактивная охрана сессии
 *
 * Три слоя защиты:
 *  1. Реактивный watch на localStorage.token (через storage events)
 *  2. Periodic heartbeat — валидация токена на сервере каждые 5 минут
 *  3. Глобальный 401-перехватчик через CustomEvent от fetch-патча
 *
 * При потере сессии:
 *  → fires SESSION_EXPIRED / USER_LOGGED_OUT в eventStore
 *  → показывает мгновенный lock-оверлей (ref)
 *  → через 1.5 сек редиректит на /login
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const HEARTBEAT_INTERVAL = 5 * 60 * 1000  // 5 минут
const LOCK_REDIRECT_DELAY = 1500           // мс до редиректа

export function useSessionGuard() {
  const router = useRouter()
  const isLocked = ref(false)
  const lockReason = ref('')    // 'logout' | 'expired' | '401'

  let heartbeatTimer = null
  let redirectTimer = null

  // ─── Блокировка экрана и редирект ──────────────────────────────────────────

  function lockAndRedirect(reason) {
    if (isLocked.value) return   // уже заблокировано

    isLocked.value = true
    lockReason.value = reason

    // Пишем событие в eventStore (fire-and-forget, не блокируем)
    _emitAuthEvent(reason)

    // Через LOCK_REDIRECT_DELAY → /login
    redirectTimer = setTimeout(() => {
      router.push('/login')
      // Сбрасываем лок после навигации
      setTimeout(() => { isLocked.value = false }, 500)
    }, LOCK_REDIRECT_DELAY)
  }

  function _emitAuthEvent(reason) {
    try {
      // Импортируем динамически чтобы не создавать циклических зависимостей
      import('@/stores/eventStore.js').then(({ useEventStore }) => {
        const store = useEventStore()
        const user = localStorage.getItem('user') || 'unknown'
        if (reason === 'logout') {
          store.add('session', `auth-${user}`, 'USER_LOGGED_OUT', { user, ts: Date.now() })
        } else if (reason === 'expired' || reason === '401') {
          store.add('session', `auth-${user}`, 'SESSION_EXPIRED', { user, reason, ts: Date.now() })
        }
      })
    } catch {}
  }

  // ─── 1. Storage events — другой таб или текущий таб очистил токен ──────────

  function onStorage(e) {
    if (e.key === 'token' && !e.newValue) {
      // Токен удалён — сессия завершена
      const path = router.currentRoute.value?.path
      if (path && path !== '/login' && path !== '/fst' && path !== '/') {
        lockAndRedirect('logout')
      }
    }
  }

  // ─── 2. MutationObserver на localStorage (текущий таб не получает storage) ─
  // Вместо MutationObserver используем polling раз в секунду — легковесно

  let tokenPollTimer = null
  let lastKnownToken = localStorage.getItem('token')

  function pollToken() {
    const current = localStorage.getItem('token')
    if (lastKnownToken && !current) {
      // Токен пропал в текущем табе
      const path = router.currentRoute.value?.path
      if (path && path !== '/login' && path !== '/fst' && path !== '/') {
        lockAndRedirect('logout')
      }
    }
    lastKnownToken = current
  }

  // ─── 3. Heartbeat — валидация на сервере ───────────────────────────────────

  async function heartbeat() {
    const token = localStorage.getItem('token')
    const userId = localStorage.getItem('id')
    if (!token || !userId) return   // нет сессии — ничего не делаем

    try {
      const resp = await fetch('/api/user/me', {
        headers: {
          'X-Integram-Token':  token,
          'X-Integram-UserId': userId,
        },
        signal: AbortSignal.timeout(10000),
      })

      if (resp.status === 401 || resp.status === 403) {
        lockAndRedirect('expired')
      }
    } catch {
      // Сетевая ошибка — не блокируем (оффлайн-режим)
    }
  }

  // ─── 4. Глобальный 401 через CustomEvent ───────────────────────────────────
  // fetch-патч в main.js или где-то выше должен диспатчить этот эвент.
  // Если патча нет — этот слой просто не срабатывает (graceful degradation).

  function on401(e) {
    const url = e.detail?.url || ''
    // Игнорируем 401 от Integram напрямую (это нормально для публичных данных)
    if (url.includes('ai2o.ru')) return
    lockAndRedirect('401')
  }

  // ─── Монтирование / размонтирование ────────────────────────────────────────

  onMounted(() => {
    window.addEventListener('storage', onStorage)
    window.addEventListener('fst-auth-401', on401)
    tokenPollTimer = setInterval(pollToken, 1000)
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL)
    // Первый heartbeat через 30 сек после загрузки
    setTimeout(heartbeat, 30_000)
  })

  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('fst-auth-401', on401)
    clearInterval(tokenPollTimer)
    clearInterval(heartbeatTimer)
    clearTimeout(redirectTimer)
  })

  return { isLocked, lockReason }
}

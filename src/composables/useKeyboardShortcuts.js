/**
 * useKeyboardShortcuts — composable for global keyboard shortcuts.
 *
 * Features:
 * - 15+ global shortcuts (navigation, search, help)
 * - Context-aware shortcuts per route
 * - Toast notification on first use of each shortcut
 * - Achievement «Клавиатурный ниндзя» after 10 unique shortcuts used
 * - Sequence shortcuts (e.g. G H, G C …)
 *
 * Usage:
 *   const { isShortcutsModalOpen } = useKeyboardShortcuts()
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'

// ─── Storage keys ────────────────────────────────────────────────────────────
const STORAGE_USED_KEY = 'shortcuts_used'
const STORAGE_NINJA_KEY = 'shortcuts_ninja_achieved'

// ─── Shared reactive state (singleton) ───────────────────────────────────────
const isShortcutsModalOpen = ref(false)

// ─── Shortcut definitions ─────────────────────────────────────────────────────
export const GLOBAL_SHORTCUTS = [
  { keys: '/', label: 'Поиск в сайдбаре', group: 'Навигация', id: 'search' },
  { keys: '?', label: 'Справка по шорткатам', group: 'Навигация', id: 'help' },
  { keys: 'G H', label: 'Перейти: Главная (Hub)', group: 'Навигация', id: 'go-hub' },
  { keys: 'G C', label: 'Перейти: Инвесткомитет', group: 'Навигация', id: 'go-committee' },
  { keys: 'G D', label: 'Перейти: Сделка', group: 'Навигация', id: 'go-deal' },
  { keys: 'G P', label: 'Перейти: Портфель', group: 'Навигация', id: 'go-portfolio' },
  { keys: 'G S', label: 'Перейти: Соурсинг', group: 'Навигация', id: 'go-sourcing' },
  { keys: 'G E', label: 'Перейти: Исполнение', group: 'Навигация', id: 'go-execution' },
  { keys: 'G F', label: 'Перейти: ЦД Фонда', group: 'Навигация', id: 'go-fund' },
  { keys: 'G L', label: 'Перейти: Обучение', group: 'Навигация', id: 'go-learning' },
  { keys: 'Esc', label: 'Закрыть модал / панель', group: 'Навигация', id: 'escape' },
  { keys: 'F1', label: 'Помощь по странице', group: 'Обучение', id: 'page-help' },
  { keys: 'F2', label: 'Режим обучения вкл/выкл', group: 'Обучение', id: 'learning-mode' },
  { keys: 'Alt+H', label: 'Перейти на Hub', group: 'Быстрый доступ', id: 'alt-hub' },
  { keys: 'Alt+N', label: 'Новая заявка', group: 'Быстрый доступ', id: 'alt-apply' },
]

export const CONTEXT_SHORTCUTS = {
  '/fst-committee': [
    { keys: 'R', label: 'Запустить ИК', group: 'Инвесткомитет', id: 'ic-run' },
    { keys: 'E', label: 'Экспорт протокола', group: 'Инвесткомитет', id: 'ic-export' },
    { keys: '←', label: 'Предыдущий агент', group: 'Инвесткомитет', id: 'ic-prev' },
    { keys: '→', label: 'Следующий агент', group: 'Инвесткомитет', id: 'ic-next' },
  ],
  '/fst-portfolio': [
    { keys: 'R', label: 'Обновить данные', group: 'Портфель', id: 'portfolio-refresh' },
    { keys: 'E', label: 'Экспорт отчёта', group: 'Портфель', id: 'portfolio-export' },
    { keys: 'F', label: 'Фильтр компаний', group: 'Портфель', id: 'portfolio-filter' },
  ],
  '/fst-deal': [
    { keys: 'S', label: 'Сохранить сделку', group: 'Сделка', id: 'deal-save' },
    { keys: 'E', label: 'Экспорт Term Sheet', group: 'Сделка', id: 'deal-export' },
    { keys: 'M', label: 'Финмодель', group: 'Сделка', id: 'deal-model' },
  ],
}

// Random shortcut of the day (deterministic per calendar day)
function getShortcutOfTheDay() {
  const day = new Date().getDate()
  const all = GLOBAL_SHORTCUTS.filter(s => s.id !== 'help' && s.id !== 'escape')
  return all[day % all.length]
}

export const shortcutOfTheDay = getShortcutOfTheDay()

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUsedShortcuts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USED_KEY) || '[]')
  } catch {
    return []
  }
}

function markShortcutUsed(id) {
  const used = getUsedShortcuts()
  if (!used.includes(id)) {
    used.push(id)
    try {
      localStorage.setItem(STORAGE_USED_KEY, JSON.stringify(used))
    } catch { /* ignore */ }
  }
  return used
}

function isFirstUse(id) {
  return !getUsedShortcuts().includes(id)
}

function hasNinjaAchievement() {
  return localStorage.getItem(STORAGE_NINJA_KEY) === '1'
}

function setNinjaAchievement() {
  try {
    localStorage.setItem(STORAGE_NINJA_KEY, '1')
  } catch { /* ignore */ }
}

// ─── Composable ───────────────────────────────────────────────────────────────
export function useKeyboardShortcuts() {
  const router = useRouter()
  const route = useRoute()
  const toast = useToast()

  // Sequence buffer for multi-key shortcuts (G H, G C …)
  let seqBuffer = ''
  let seqTimer = null
  const SEQ_TIMEOUT = 800 // ms

  function resetSeq() {
    seqBuffer = ''
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null }
  }

  function handleShortcutUsed(id, label) {
    const first = isFirstUse(id)
    const used = markShortcutUsed(id)

    if (first) {
      toast.add({
        severity: 'info',
        summary: '⌨️ Шорткат активирован',
        detail: `Вы использовали: ${label}`,
        life: 2500,
        group: 'br',
      })
    }

    // Check ninja achievement
    if (used.length >= 10 && !hasNinjaAchievement()) {
      setNinjaAchievement()
      setTimeout(() => {
        toast.add({
          severity: 'success',
          summary: '⌨️ Клавиатурный ниндзя!',
          detail: 'Достижение разблокировано: вы использовали 10+ шорткатов',
          life: 5000,
          group: 'br',
        })
      }, 600)
    }
  }

  function navigate(path, shortcutId, label) {
    handleShortcutUsed(shortcutId, label)
    router.push(path)
  }

  function focusSidebarSearch() {
    const el = document.querySelector('.layout-sidebar input[type="text"], .layout-sidebar input[type="search"], .p-inputtext')
    if (el) { el.focus(); el.select() }
  }

  function emitContextEvent(eventName) {
    window.dispatchEvent(new CustomEvent('fst-shortcut', { detail: { action: eventName } }))
  }

  const keydownHandler = (e) => {
    // Ignore if user is typing in an input, textarea, or contenteditable
    const tag = document.activeElement?.tagName?.toLowerCase()
    const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' ||
      document.activeElement?.isContentEditable

    // Allow Escape and ? even in inputs
    const bypassInputCheck = e.key === 'Escape' || (e.key === '?' && !isEditable)
    if (isEditable && !bypassInputCheck) { resetSeq(); return }

    // --- Single-key shortcuts ---

    // ? → open shortcuts modal
    if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      isShortcutsModalOpen.value = !isShortcutsModalOpen.value
      handleShortcutUsed('help', 'Справка по шорткатам')
      resetSeq()
      return
    }

    // / → focus sidebar search
    if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      focusSidebarSearch()
      handleShortcutUsed('search', 'Поиск в сайдбаре')
      resetSeq()
      return
    }

    // Esc → close modal
    if (e.key === 'Escape') {
      if (isShortcutsModalOpen.value) {
        isShortcutsModalOpen.value = false
        handleShortcutUsed('escape', 'Закрыть панель')
      }
      resetSeq()
      return
    }

    // F1 → page help
    if (e.key === 'F1') {
      e.preventDefault()
      handleShortcutUsed('page-help', 'Помощь по странице')
      window.dispatchEvent(new CustomEvent('fst-shortcut', { detail: { action: 'page-help' } }))
      resetSeq()
      return
    }

    // F2 → learning mode toggle
    if (e.key === 'F2') {
      e.preventDefault()
      handleShortcutUsed('learning-mode', 'Режим обучения')
      window.dispatchEvent(new CustomEvent('fst-shortcut', { detail: { action: 'learning-mode' } }))
      resetSeq()
      return
    }

    // Alt+H → hub
    if (e.altKey && e.key === 'h') {
      e.preventDefault()
      navigate('/fst-hub', 'alt-hub', 'Перейти на Hub')
      resetSeq()
      return
    }

    // Alt+N → new application
    if (e.altKey && e.key === 'n') {
      e.preventDefault()
      navigate('/fst-apply', 'alt-apply', 'Новая заявка')
      resetSeq()
      return
    }

    // --- Context shortcuts (only when not in an input) ---
    const currentPath = route.path
    const ctxShortcuts = CONTEXT_SHORTCUTS[currentPath] || []

    if (!isEditable) {
      // Context shortcuts that are single keys: R, E, ←, →, F, S, M
      if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const key = e.key

        // Check context shortcuts first
        const ctxMatch = ctxShortcuts.find(s => {
          if (s.keys === '←') return key === 'ArrowLeft'
          if (s.keys === '→') return key === 'ArrowRight'
          return s.keys.toLowerCase() === key.toLowerCase()
        })

        if (ctxMatch) {
          // Only intercept if seqBuffer is empty (not mid-sequence)
          if (!seqBuffer) {
            e.preventDefault()
            handleShortcutUsed(ctxMatch.id, ctxMatch.label)
            emitContextEvent(ctxMatch.id)
            return
          }
        }
      }

      // --- Sequence shortcuts: G + second key ---
      if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const key = e.key.toUpperCase()

        if (seqBuffer === 'G') {
          resetSeq()
          const seqMap = {
            'H': ['/fst-hub', 'go-hub', 'Перейти: Главная'],
            'C': ['/fst-committee', 'go-committee', 'Перейти: Инвесткомитет'],
            'D': ['/fst-deal', 'go-deal', 'Перейти: Сделка'],
            'P': ['/fst-portfolio', 'go-portfolio', 'Перейти: Портфель'],
            'S': ['/fst-sourcing', 'go-sourcing', 'Перейти: Соурсинг'],
            'E': ['/fst-execution', 'go-execution', 'Перейти: Исполнение'],
            'F': ['/fst-fund', 'go-fund', 'Перейти: ЦД Фонда'],
            'L': ['/fst-learning', 'go-learning', 'Перейти: Обучение'],
          }
          if (seqMap[key]) {
            e.preventDefault()
            const [path, id, label] = seqMap[key]
            navigate(path, id, label)
          }
          return
        }

        if (key === 'G') {
          seqBuffer = 'G'
          seqTimer = setTimeout(resetSeq, SEQ_TIMEOUT)
          return
        }
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', keydownHandler)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', keydownHandler)
    resetSeq()
  })

  return {
    isShortcutsModalOpen,
    shortcutOfTheDay,
    GLOBAL_SHORTCUTS,
    CONTEXT_SHORTCUTS,
    getUsedShortcuts,
  }
}

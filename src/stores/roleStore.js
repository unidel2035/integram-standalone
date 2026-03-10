/**
 * Role Store — ролевая система VentureOS
 *
 * Единственный источник правды: Integram, таблица 18, поле 115 (Роль → type 42)
 * Роли в Integram type 42: investor(52536), expert(52559), director(52560),
 *                           analyst(52561), startup(52562), admin(145)
 *
 * Роли читаются через бэкенд GET /api/user/me при инициализации.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ── Профили ролей ───────────────────────────────────────────────
export const ROLE_PROFILES = {
  investor: {
    id: 'investor',
    label: 'Инвестор',
    labelShort: 'Инвестор',
    icon: 'pi pi-briefcase',
    color: 'var(--fst-purple)',
    description: 'Инвестиционный директор фонда'
  },
  expert: {
    id: 'expert',
    label: 'Эксперт ИК',
    labelShort: 'Эксперт',
    icon: 'pi pi-star',
    color: 'var(--fst-blue)',
    description: 'Эксперт инвестиционного комитета'
  },
  director: {
    id: 'director',
    label: 'Директор',
    labelShort: 'Директор',
    icon: 'pi pi-crown',
    color: 'var(--fst-brand)',
    description: 'Генеральный директор фонда'
  },
  analyst: {
    id: 'analyst',
    label: 'Аналитик',
    labelShort: 'Аналитик',
    icon: 'pi pi-chart-bar',
    color: 'var(--fst-green)',
    description: 'Финансовый/технический аналитик'
  },
  startup: {
    id: 'startup',
    label: 'Стартап',
    labelShort: 'Стартап',
    icon: 'pi pi-rocket',
    color: 'var(--fst-cyan)',
    description: 'Основатель стартапа'
  },
  admin: {
    id: 'admin',
    label: 'Администратор',
    labelShort: 'Админ',
    icon: 'pi pi-cog',
    color: 'var(--fst-red)',
    description: 'Полный доступ ко всем функциям'
  }
}

// expert_id — маппинг логин → id аватара (платформенный конфиг, не бизнес-данные)
const EXPERT_ID_MAP = {
  gds: 'gordin',
  gordin: 'gordin',
  dgordin: 'gordin',
  medvedev: 'medvedev',
  babincev: 'babincev',
}

const LS_ROLE_KEY      = 'fst_active_role'
const LS_FULL_MENU_KEY = 'fst_full_menu'

export const useRoleStore = defineStore('role', () => {
  // ── State ────────────────────────────────────────────────────
  const activeRole      = ref(localStorage.getItem(LS_ROLE_KEY) || 'analyst')
  const fullMenuMode    = ref(localStorage.getItem(LS_FULL_MENU_KEY) === 'true')
  const profileRoles    = ref([])    // роли из Integram
  const currentUserName = ref('')
  const currentDisplayName = ref('')

  // ── Computed ─────────────────────────────────────────────────
  const availableRoles = computed(() =>
    profileRoles.value.map(r => ROLE_PROFILES[r]).filter(Boolean)
  )

  const currentRole = computed(() =>
    ROLE_PROFILES[activeRole.value] || ROLE_PROFILES.analyst
  )

  const expertId = computed(() =>
    EXPERT_ID_MAP[currentUserName.value.toLowerCase()] || null
  )

  const isAdmin = computed(() => profileRoles.value.includes('admin'))

  const canSeeFullMenu = computed(() => isAdmin.value && fullMenuMode.value)

  // ── Methods ──────────────────────────────────────────────────
  function setRole(roleId) {
    if (!availableRoles.value.find(r => r.id === roleId)) return
    activeRole.value = roleId
    localStorage.setItem(LS_ROLE_KEY, roleId)
    window.dispatchEvent(new CustomEvent('fst-role-changed', { detail: roleId }))
  }

  function toggleFullMenu() {
    if (!isAdmin.value) return
    fullMenuMode.value = !fullMenuMode.value
    localStorage.setItem(LS_FULL_MENU_KEY, String(fullMenuMode.value))
  }

  function hasMenuAccess(itemRoles) {
    if (!itemRoles || itemRoles.length === 0) return true
    if (canSeeFullMenu.value) return true
    return itemRoles.includes(activeRole.value)
  }

  async function init() {
    const name   = (localStorage.getItem('user') || '').toLowerCase().trim()
    const userId = localStorage.getItem('id')
    const token  = localStorage.getItem('token')

    currentUserName.value = name

    if (!token || !userId) {
      // Нет сессии — дефолт analyst
      profileRoles.value = ['analyst']
      return
    }

    try {
      const resp = await fetch('/api/user/me', {
        headers: {
          'X-Integram-Token':  token,
          'X-Integram-UserId': userId
        }
      })
      if (resp.ok) {
        const d = await resp.json()
        if (d.roles?.length) profileRoles.value = d.roles
        if (d.displayName)   currentDisplayName.value = d.displayName
      }
    } catch { /* если бэкенд недоступен — оставляем analyst */ }

    // Если Integram не вернул роли — fallback
    if (!profileRoles.value.length) profileRoles.value = ['analyst']

    // Проверяем что текущая роль доступна
    const allRoles = availableRoles.value.map(r => r.id)
    if (!allRoles.includes(activeRole.value)) {
      const first = allRoles[0] || 'analyst'
      activeRole.value = first
      localStorage.setItem(LS_ROLE_KEY, first)
    }
  }

  return {
    activeRole, fullMenuMode, currentUserName, currentDisplayName,
    availableRoles, currentRole, expertId, isAdmin, canSeeFullMenu,
    setRole, toggleFullMenu, hasMenuAccess, init
  }
})

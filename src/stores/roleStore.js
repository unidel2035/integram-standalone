/**
 * Role Store — ролевая система VentureOS
 *
 * Роли: investor | expert | director | analyst | startup | admin
 * Пользователь может иметь несколько доступных ролей и переключаться между ними.
 * Текущая роль влияет на меню и на то, какой аватар эксперта открывается по умолчанию.
 *
 * Источник данных: Integram поле профиля пользователя (fst_roles, fst_role, expert_id).
 * Fallback: конфиг по имени пользователя.
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

// ── Конфиг пользователей → роли + expert_id ────────────────────
// Источник правды: Integram (поле fst_roles и expert_id в профиле пользователя).
// Этот конфиг — fallback когда Integram недоступен или профиль не настроен.
const USER_CONFIG = {
  // key = имя пользователя (toLowerCase, trim)
  gordin: {
    roles: ['investor', 'expert', 'admin'],
    defaultRole: 'investor',
    expertId: 'gordin'
  },
  'dgordin': {
    roles: ['investor', 'expert', 'admin'],
    defaultRole: 'investor',
    expertId: 'gordin'
  },
  'д.гордин': {
    roles: ['investor', 'expert', 'admin'],
    defaultRole: 'investor',
    expertId: 'gordin'
  },
  medvedev: {
    roles: ['director', 'admin'],
    defaultRole: 'director',
    expertId: 'medvedev'
  },
  babincev: {
    roles: ['expert'],
    defaultRole: 'expert',
    expertId: 'babincev'
  },
  // Дефолт — любой незнакомый пользователь
  _default: {
    roles: ['analyst'],
    defaultRole: 'analyst',
    expertId: null
  }
}

const LS_ROLE_KEY = 'fst_active_role'
const LS_FULL_MENU_KEY = 'fst_full_menu'

export const useRoleStore = defineStore('role', () => {
  // ── State ────────────────────────────────────────────────────
  const activeRole = ref(localStorage.getItem(LS_ROLE_KEY) || 'analyst')
  const fullMenuMode = ref(localStorage.getItem(LS_FULL_MENU_KEY) === 'true')

  // Данные из Integram профиля (загружаются при init)
  const profileRoles = ref(null)       // string[] из Integram или null
  const profileExpertId = ref(null)    // expert_id из Integram или null
  const currentUserName = ref('')

  // ── Computed ─────────────────────────────────────────────────
  const userConfig = computed(() => {
    const name = currentUserName.value.toLowerCase().trim()
    return USER_CONFIG[name] || USER_CONFIG._default
  })

  const availableRoles = computed(() => {
    // Integram профиль имеет приоритет
    const roles = profileRoles.value || userConfig.value.roles
    return roles.map(r => ROLE_PROFILES[r]).filter(Boolean)
  })

  const currentRole = computed(() => ROLE_PROFILES[activeRole.value] || ROLE_PROFILES.analyst)

  const expertId = computed(() => profileExpertId.value || userConfig.value.expertId || null)

  const isAdmin = computed(() => {
    const roles = profileRoles.value || userConfig.value.roles
    return roles.includes('admin')
  })

  const canSeeFullMenu = computed(() => isAdmin.value && fullMenuMode.value)

  // ── Methods ──────────────────────────────────────────────────
  function setRole(roleId) {
    const roles = profileRoles.value || userConfig.value.roles
    if (!roles.includes(roleId) && roleId !== 'admin') return
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
    // Нет ограничений — видят все
    if (!itemRoles || itemRoles.length === 0) return true
    // Полный доступ — видит всё
    if (canSeeFullMenu.value) return true
    // Проверяем роль
    return itemRoles.includes(activeRole.value)
  }

  async function init() {
    // 1. Читаем имя из localStorage (ставится при логине в Integram)
    const name = (
      localStorage.getItem('my_user') ||
      localStorage.getItem('user') ||
      localStorage.getItem('currentUserName') ||
      ''
    ).toLowerCase().trim()

    currentUserName.value = name

    // 2. Проверяем Integram профиль на fst_roles, fst_role, expert_id
    try {
      const token = localStorage.getItem('my_token') || localStorage.getItem('token')
      const apiBase = localStorage.getItem('apiBase') || 'https://api.ai2o.ru'
      const db = 'my'

      if (token) {
        const r = await fetch(`${apiBase}/${db}/xsrf?JSON_KV`, {
          headers: { 'X-Authorization': token }
        })
        if (r.ok) {
          const d = await r.json()
          // Читаем fst_roles из Integram профиля
          if (d.fst_roles) {
            profileRoles.value = Array.isArray(d.fst_roles)
              ? d.fst_roles
              : d.fst_roles.split(',').map(s => s.trim())
          }
          if (d.expert_id) profileExpertId.value = d.expert_id
          if (d.fst_role && !d.fst_roles) profileRoles.value = [d.fst_role]

          // Обновляем имя из профиля
          if (d.user) currentUserName.value = d.user.toLowerCase().trim()
        }
      }
    } catch { /* используем fallback конфиг */ }

    // 3. Устанавливаем дефолтную роль если текущая не доступна
    const roles = profileRoles.value || userConfig.value.roles
    if (!roles.includes(activeRole.value)) {
      const defaultRole = userConfig.value.defaultRole || roles[0] || 'analyst'
      activeRole.value = defaultRole
      localStorage.setItem(LS_ROLE_KEY, defaultRole)
    }
  }

  return {
    activeRole, fullMenuMode, currentUserName,
    availableRoles, currentRole, expertId, isAdmin, canSeeFullMenu,
    setRole, toggleFullMenu, hasMenuAccess, init
  }
})

<script setup>
import { logger } from '@/utils/logger'
import { useLayout } from '@/layout/composables/layout'
import { useRoute } from 'vue-router'
import Badge from 'primevue/badge'
import Avatar from 'primevue/avatar'
// Lazy load AppConfigurator - only shown when theme settings are opened
import { defineAsyncComponent } from 'vue'
const AppConfigurator = defineAsyncComponent(() => import('./AppConfigurator.vue'))
// Lazy load ProfileMenu - only shown when profile is clicked
const ProfileMenu = defineAsyncComponent(() => import('./Profile.vue'))
// Lazy load NotificationCenter - only shown when notifications are opened
const NotificationCenter = defineAsyncComponent(() => import('@/components/NotificationCenter.vue'))
// Lazy load AgentStatusPanel - only shown when agents button is clicked
const AgentStatusPanel = defineAsyncComponent(() => import('@/components/AgentStatusPanel.vue'))
// Issue #6934: Logo moved to sidebar, no longer needed here
// import LogoDisplay from '@/components/LogoDisplay.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { useNotifications } from '@/composables/notifications'
import { usePwaInstall } from '@/composables/usePwaInstall'
import { useWorkspaceAgentStore } from '@/stores/workspaceAgentStore'
import { useLearnModeStore } from '@/stores/learnModeStore'
import { useI18n } from 'vue-i18n'
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue'

// Issue #6934: Route detection for block-editor
const route = useRoute()

const { t } = useI18n()
const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout()
const { unreadCount } = useNotifications()
const learnModeStore = useLearnModeStore()
// Issue #7230: PWA install prompt
const { canInstall, isInstalled, promptInstall } = usePwaInstall()

const handleInstallClick = async () => {
  if (canInstall.value) {
    await promptInstall()
  } else {
    const ua = navigator.userAgent
    if (/android/i.test(ua)) {
      alert('Нажмите ⋮ (меню) → "Добавить на главный экран"')
    } else if (/iphone|ipad/i.test(ua)) {
      alert('Нажмите "Поделиться" → "На экран Домой"')
    } else {
      alert('Нажмите ⋮ или ⋯ в адресной строке браузера → "Установить приложение"')
    }
  }
}

// Issue #6934: Check if we're on the block-editor route
const isBlockEditorRoute = computed(() => route.path === '/block-editor')

// Issue #6946: Check if we're on an Integram route (for topbar breadcrumbs behavior)
const isIntegramRoute = computed(() => route.path === '/integram' || route.path.startsWith('/integram/'))

// Safely access workspaceAgentStore - handle case where Pinia might not be ready yet (Issue #5216)
let workspaceAgentStore
try {
  workspaceAgentStore = useWorkspaceAgentStore()
} catch (error) {
  console.warn('[AppTopbar] Pinia not ready, deferring workspaceAgentStore access:', error.message)
  workspaceAgentStore = null
}

const profileOverlay = ref() // Template ref for ProfileMenu component
const notificationVisible = ref(false)
const agentPanelVisible = ref(false)
const configVisible = ref(false)
const configPanelRef = ref(null) // Ref for config panel (click-outside detection)
const pendingProfileToggle = ref(null) // Сохраняет событие клика, если компонент ещё не загружен
const profileMenuReady = ref(false) // Флаг готовности компонента
// Clear stale Integram direct URLs (they require auth, can't be loaded by <img>)
const cachedPhoto = localStorage.getItem('currentUserPhoto') || ''
if (cachedPhoto && !cachedPhoto.startsWith('/api/')) {
  localStorage.removeItem('currentUserPhoto')
}
const userPhoto = ref(cachedPhoto.startsWith('/api/') ? cachedPhoto : '')
const photoFailed = ref(false) // set to true on @error, prevents re-showing broken img
const userName = ref(
  localStorage.getItem('my_user') ||
  localStorage.getItem('currentUserName') ||
  localStorage.getItem('user') ||
  ''
)

// First letter from name or email — never show '?'
const userInitial = computed(() => {
  const name = userName.value || ''
  if (!name) return '?'
  // If it's an email, use the part before @
  const base = name.includes('@') ? name.split('@')[0] : name
  return base.charAt(0).toUpperCase()
})

// Cleanup handlers for memory leak prevention
let chatStorageCleanup = null
let photoStorageCleanup = null
let photoUpdateInterval = null
let pendingCheckInterval = null
let configClickOutsideCleanup = null

const emit = defineEmits(['chat-toggle'])

// Agent-related computed
const runningAgentsCount = computed(() => workspaceAgentStore?.runningAgentsCount || 0)
const hasActiveAgents = computed(() => workspaceAgentStore?.hasActiveAgents || false)

const toggleNotifications = () => {
  notificationVisible.value = !notificationVisible.value
}

const toggleAgentPanel = () => {
  agentPanelVisible.value = !agentPanelVisible.value
}

const toggleConfig = (event) => {
  configVisible.value = !configVisible.value
  event.stopPropagation()
}

const isChatOpen = ref(localStorage.getItem('chat') === 'true')

const handleChat = () => {
  const currentState = localStorage.getItem('chat') === 'true'
  const newState = !currentState
  localStorage.setItem('chat', newState.toString())
  isChatOpen.value = newState
  logger.debug(newState)
  emit('chat-toggle', newState)
}

// Проверяем готовность ProfileMenu компонента
const checkProfileMenuReady = () => {
  if (profileOverlay.value && typeof profileOverlay.value.toggle === 'function') {
    profileMenuReady.value = true
    // Если был отложенный клик - выполняем его
    if (pendingProfileToggle.value) {
      profileOverlay.value.toggle(pendingProfileToggle.value)
      pendingProfileToggle.value = null
    }
    return true
  }
  return false
}

// Наблюдаем за ref компонента для определения момента загрузки
watch(profileOverlay, () => {
  nextTick(() => {
    checkProfileMenuReady()
  })
}, { immediate: true })

const handleToggle = event => {
  // Если компонент готов - сразу вызываем toggle
  if (profileMenuReady.value && profileOverlay.value && typeof profileOverlay.value.toggle === 'function') {
    profileOverlay.value.toggle(event)
  } else {
    // Сохраняем событие клика для выполнения после загрузки
    pendingProfileToggle.value = event
    logger.debug('ProfileMenu загружается, ожидание...')

    // Очистить предыдущий интервал если он существует
    if (pendingCheckInterval) {
      clearInterval(pendingCheckInterval)
    }

    // Попытка проверить готовность через короткий интервал
    let attempts = 0
    const maxAttempts = 10
    pendingCheckInterval = setInterval(() => {
      attempts++
      if (checkProfileMenuReady() || attempts >= maxAttempts) {
        clearInterval(pendingCheckInterval)
        pendingCheckInterval = null
        if (attempts >= maxAttempts && !profileMenuReady.value) {
          logger.warn('ProfileMenu не загрузился после нескольких попыток')
          pendingProfileToggle.value = null
        }
      }
    }, 100)
  }
}

const updateFavicon = () => {
  const link = document.querySelector("link[rel*='icon']")
  if (link) {
    link.href = isDarkTheme.value ? '/meta/icon2.svg' : '/meta/icon1.svg?upd'
  }
}

// Computed properties for i18n
const themeTooltip = computed(() => {
  return isDarkTheme.value ? t('theme.light', 'Включить светлую') : t('theme.dark', 'Включить тёмную')
})

const themeSettingsTooltip = computed(() => {
  return t('theme.settings', 'Настройки темы')
})

const notificationsTooltip = computed(() => {
  return t('notifications.title', 'Уведомления')
})

const chatTooltip = computed(() => {
  return t('nav.chat', 'Чат')
})

const profileTooltip = computed(() => {
  return t('nav.profile', 'Профиль')
})

const agentsTooltip = computed(() => {
  const count = runningAgentsCount.value
  if (count === 0) {
    return t('agents.noRunning', 'Нет запущенных агентов')
  }
  return t('agents.running', 'Запущено агентов') + `: ${count}`
})

const learnModeTooltip = computed(() => {
  return learnModeStore.isLearningMode
    ? t('learn.disable', 'Выключить режим обучения')
    : t('learn.enable', 'Включить режим обучения')
})

watch(isDarkTheme, updateFavicon)

// Listen for userPhoto updates from Profile.vue
const updateUserPhoto = () => {
  if (photoFailed.value) return // don't restore after explicit error
  const stored = localStorage.getItem('currentUserPhoto') || ''
  if (stored.startsWith('/api/')) userPhoto.value = stored
}

// Handle photo load error (404, 401, etc.) - permanently fall back to initials
const handlePhotoError = () => {
  logger.debug('[AppTopbar] Photo load error, showing initials')
  userPhoto.value = ''
  photoFailed.value = true
  const userId = localStorage.getItem('id')
  if (userId) localStorage.removeItem(`userPhoto_${userId}`)
  localStorage.removeItem('currentUserPhoto')
}

// Fetch user photo from API if not in localStorage
const fetchUserPhotoOnMount = async () => {
  const token = localStorage.getItem('my_token') || localStorage.getItem('token')
  const userId = localStorage.getItem('id')

  if (!token || !userId) return

  try {
    // Get profile data (name + whether photo exists)
    const response = await fetch(`/api/profile/${userId}`, {
      headers: { 'X-Authorization': token }
    })

    if (!response.ok) return
    const data = await response.json()
    if (!data.success) return

    // Always update name from profile API (not only when empty)
    if (data.data?.name) {
      userName.value = data.data.name
      localStorage.setItem('my_user', data.data.name)
    }

    // Use proxy URL — browser can't load Integram URLs directly (requires auth)
    if (data.data?.photo) {
      photoFailed.value = false
      const proxyUrl = `/api/profile/${userId}/photo?t=${Date.now()}`
      userPhoto.value = proxyUrl
      localStorage.setItem('currentUserPhoto', proxyUrl)
    } else {
      // No photo in table 18 — clear any stale cache and show initials
      userPhoto.value = ''
      photoFailed.value = false
      localStorage.removeItem('currentUserPhoto')
    }
  } catch (error) {
    logger.debug('Failed to fetch user photo on mount:', error)
  }
}

const paletteBtn = ref(null)

onMounted(() => {
  updateFavicon()
  // Fetch user photo immediately on mount
  fetchUserPhotoOnMount()

  // Close config panel when clicking outside it
  const handleConfigClickOutside = (e) => {
    if (configVisible.value && configPanelRef.value && !configPanelRef.value.contains(e.target)) {
      // Also ignore clicks on the toggle button itself (handled by toggleConfig)
      configVisible.value = false
    }
  }
  document.addEventListener('click', handleConfigClickOutside)
  configClickOutsideCleanup = () => document.removeEventListener('click', handleConfigClickOutside)

  // Open theme settings from Profile menu
  // Use setTimeout to defer past the current click event's document bubbling.
  // If we set configVisible=true synchronously, the click that triggered this event
  // will bubble to document and fire handleConfigClickOutside, closing the panel again.
  window.addEventListener('open-theme-settings', () => {
    setTimeout(() => {
      configVisible.value = true
    }, 0)
  })

  // Listen for chat storage changes from other tabs/windows
  const handleChatStorage = (e) => {
    if (e.key === 'chat') {
      isChatOpen.value = e.newValue === 'true'
    }
  }
  window.addEventListener('storage', handleChatStorage)
  chatStorageCleanup = () => window.removeEventListener('storage', handleChatStorage)

  // Listen for photo storage changes (when Profile.vue updates the photo)
  const handlePhotoStorage = (e) => {
    if (e.key === 'currentUserPhoto') {
      updateUserPhoto()
    }
  }
  window.addEventListener('storage', handlePhotoStorage)
  photoStorageCleanup = () => window.removeEventListener('storage', handlePhotoStorage)

  // Also check periodically in case storage event doesn't fire (same tab)
  photoUpdateInterval = setInterval(updateUserPhoto, 3000)
})

onBeforeUnmount(() => {
  // Cleanup all event listeners and intervals
  if (chatStorageCleanup) chatStorageCleanup()
  if (photoStorageCleanup) photoStorageCleanup()
  if (photoUpdateInterval) clearInterval(photoUpdateInterval)
  if (pendingCheckInterval) clearInterval(pendingCheckInterval)
  if (configClickOutsideCleanup) configClickOutsideCleanup()
})

</script>

<template>
  <div class="layout-topbar" :class="{ 'topbar-block-editor': isBlockEditorRoute, 'topbar-integram': isIntegramRoute }">
    <div class="layout-topbar-logo-container" :class="{ 'logo-hidden': isBlockEditorRoute || isIntegramRoute }">
      <button
        class="layout-menu-button layout-topbar-action"
        @click="toggleMenu"
      >
        <i class="pi pi-bars"/>
      </button>
      <!-- Issue #6934: Logo moved to sidebar, menu button stays -->
    </div>

    <div class="layout-topbar-actions">
      <div class="layout-config-menu">
        <LanguageSwitcher />

        <!-- Issue #109: Learning mode toggle -->
        <button
          type="button"
          class="layout-topbar-action"
          :class="{ 'layout-topbar-action-highlight': learnModeStore.isLearningMode }"
          @click="learnModeStore.toggleLearningMode"
          v-tooltip.bottom="learnModeTooltip"
        >
          <i class="pi pi-lightbulb"></i>
        </button>

        <!-- Issue #7230: PWA install button — only on /welcome -->
        <button
          v-if="!isInstalled && route.path === '/welcome'"
          type="button"
          class="layout-topbar-action pwa-install-btn"
          @click="handleInstallClick"
          v-tooltip.bottom="'Скачать приложение'"
        >
          <i class="pi pi-download"></i>
        </button>

        <button
          type="button"
          class="layout-topbar-action"
          @click="toggleDarkMode"
          :title="themeTooltip"
        >
          <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
        </button>

        <div v-if="configVisible" class="relative">
          <button
            ref="paletteBtn"
            type="button"
            class="layout-topbar-action layout-topbar-action-highlight"
            :title="themeSettingsTooltip"
            @click="toggleConfig"
          >
            <i class="pi pi-palette"></i>
          </button>
          <div v-show="configVisible" class="config-panel-dropdown" ref="configPanelRef">
            <AppConfigurator />
          </div>
        </div>
      </div>

      <button
        class="layout-topbar-menu-button layout-topbar-action"
        v-styleclass="{
          selector: '@next',
          enterFromClass: 'hidden',
          enterActiveClass: 'animate-scalein',
          leaveToClass: 'hidden',
          leaveActiveClass: 'animate-fadeout',
          hideOnOutsideClick: true,
        }"
      >
        <i class="pi pi-ellipsis-v"/>
      </button>

      <div class="layout-topbar-menu hidden lg:block">
        <div class="layout-topbar-menu-content">
          <button
            @click="toggleNotifications"
            type="button"
            class="layout-topbar-action relative"
            :title="notificationsTooltip"
          >
            <i class="pi pi-bell"/>
            <Badge
              v-if="unreadCount > 0"
              :value="unreadCount > 99 ? '99+' : unreadCount.toString()"
              severity="danger"
              class="notification-badge-topbar"
            />
            <span>{{ $t('notifications.title', 'Уведомления') }}</span>
          </button>
          <button
            @click="handleChat"
            type="button"
            class="layout-topbar-action"
            :class="{ 'active': isChatOpen }"
            :title="chatTooltip"
          >
            <i class="pi pi-comments"/>
            <span>{{ $t('nav.chat', 'Чат') }}</span>
          </button>
          <button
            @click="handleToggle"
            type="button"
            class="layout-topbar-action"
            :title="profileTooltip"
          >
            <div class="topbar-avatar-wrap">
              <div class="topbar-avatar topbar-avatar-initials">{{ userInitial }}</div>
              <img
                v-if="userPhoto"
                :src="userPhoto"
                @error="handlePhotoError"
                class="topbar-avatar topbar-avatar-img topbar-avatar-over"
                alt=""
              />
            </div>
            <span>{{ $t('nav.profile', 'Профиль') }}</span>
          </button>
        </div>
      </div>
    </div>
    <ProfileMenu ref="profileOverlay" />
    <NotificationCenter
      v-model:visible="notificationVisible"
      @close="notificationVisible = false"
    />
    <AgentStatusPanel
      v-model:visible="agentPanelVisible"
      @close="agentPanelVisible = false"
    />
  </div>
</template>
<style scoped>
.layout-topbar .layout-topbar-logo svg {
  width: 10rem;
  position: relative;
}

.notification-badge-topbar,
.agent-badge-topbar {
  position: absolute !important;
  top: 0 !important;
  right: -0.1rem !important;
  min-width: 0.85rem !important;
  height: 0.85rem !important;
  padding: 0 0.2rem !important;
  font-size: 0.6rem !important;
  font-weight: 700 !important;
  z-index: 10;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
}

.agent-active {
  color: var(--p-green-500);
  animation: agent-pulse 2s ease-in-out infinite;
}

@keyframes agent-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/*
.pulsing-path {
  animation: pulse 1s infinite ease-in-out;
  transform-origin: center;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}*/

.topbar-avatar-wrap {
  position: relative;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.topbar-avatar {
  width: 1.5rem;
  height: 1.5rem;
}

.topbar-avatar-img {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

/* overlay: image sits on top of initials, hidden if broken */
.topbar-avatar-over {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.topbar-avatar-initials {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--p-primary-500, #6366f1);
  color: var(--p-surface-0, #fff);
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  user-select: none;
}

.config-panel-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 1000;
  animation: scalein 0.15s ease-in-out;
  transform-origin: top right;
}

@keyframes scalein {
  from {
    opacity: 0;
    transform: scaleY(0.8);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* Issue #6934: Hide logo container on block-editor route */
.layout-topbar-logo-container.logo-hidden {
  /* Keep menu button visible but hide logo space */
  width: auto;
  flex-shrink: 0;
}

/* Make topbar accommodate editor header content */
.layout-topbar.topbar-block-editor {
  gap: 0.5rem;
}

/* Issue #6946: Make topbar accommodate Integram header content (same as block-editor) */
.layout-topbar.topbar-integram {
  gap: 0.5rem;
}

/* Issue #7230: PWA install button */
.pwa-install-btn {
  color: var(--p-primary-500, #6366f1);
}

.pwa-install-btn:hover {
  background: var(--p-primary-50, rgba(99, 102, 241, 0.1));
}

/* Issue #109: Learning mode button highlight */
.layout-topbar-action-highlight {
  background: var(--p-yellow-50, rgba(255, 193, 7, 0.1));
  color: var(--p-yellow-600, #f59e0b);
}

:root.dark .layout-topbar-action-highlight {
  background: rgba(255, 193, 7, 0.15);
  color: var(--p-yellow-400, #fbbf24);
}
</style>

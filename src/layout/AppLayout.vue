<script setup>
import { useLayout } from '@/layout/composables/layout'
import { computed, ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
// Lazy load AppFooter to avoid dynamic import issues when AppLayout is lazy-loaded
const AppFooter = defineAsyncComponent(() => import('./AppFooter.vue'))
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
// FstBreadcrumb moved into AppTopbar
// Lazy load Chat component - it's 2097 lines and significantly impacts page load
const Chat = defineAsyncComponent(() => import('./Chat.vue'))
import packageJson from '../../package.json'

import ErrorBoundary from '@/components/ErrorBoundary.vue'
import Toast from 'primevue/toast'
import RoleSelectionModal from '@/components/RoleSelectionModal.vue'
import { isRoleSelected } from '@/config/learningPaths'
import ShortcutsModal from '@/components/fst-shared/ShortcutsModal.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useRoleStore } from '@/stores/roleStore'
import { usePresentBroadcast } from '@/composables/usePresentBroadcast'
import { useSessionGuard } from '@/composables/useSessionGuard'

const route = useRoute()
const { layoutConfig, layoutState, isSidebarActive } = useLayout()
const roleStore = useRoleStore()
const { isPresentDisplay } = usePresentBroadcast()
const { isLocked, lockReason } = useSessionGuard()

// Сайдбар скрыт только для внешних ролей (startup, investor).
// Внутренние сотрудники (admin, director, analyst, expert) видят полное меню.
const EXTERNAL_ROLES = ['startup', 'investor']
const hideSidebar = computed(() => {
  if (roleStore.availableRoles.length === 0) return false // роли ещё не загружены
  const roles = roleStore.availableRoles.map(r => r.id)
  return roles.every(r => EXTERNAL_ROLES.includes(r))
})

// Global keyboard shortcuts — registers listeners for the whole app
useKeyboardShortcuts()

const outsideClickListener = ref(null)
const isChatActive = ref(false)
const chatWidth = ref(parseInt(localStorage.getItem('chatWidth')) || 320)
const showReleaseNotes = ref(false)
const showRoleModal = ref(false)

// Инициализация состояния чата
const chatWidthInterval = ref(null)
const storageHandler = ref(null)

// Функция для определения мобильного устройства
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 960 // Соответствует медиа-запросу в Chat.vue
}

onMounted(() => {
  // Сбрасываем collapsed-состояние сайдбара — убираем "каждый второй клик"
  // layoutState.sidebarCollapsed = false сделает сайдбар полностью раскрытым
  if (layoutState.sidebarCollapsed) {
    layoutState.sidebarCollapsed = false
    localStorage.setItem('sidebarCollapsed', 'false')
  }
  // Убираем staticMenuDesktopInactive чтобы меню было видно при входе
  layoutState.staticMenuDesktopInactive = false
  // Раскрываем все группы меню — убираем необходимость двойного клика
  localStorage.removeItem('sidebar_collapsed_groups')

  const chatState = window.localStorage.getItem('chat')

  // Если состояние чата не сохранено, используем дефолтное значение
  // На мобильных устройствах чат свёрнут по умолчанию, на десктопе - открыт
  if (chatState === null) {
    isChatActive.value = !isMobileDevice()
    window.localStorage.setItem('chat', JSON.stringify(isChatActive.value))
  } else {
    isChatActive.value = JSON.parse(chatState)
  }

  // Store handler reference for proper cleanup
  storageHandler.value = (e) => {
    if (e.key === 'chat') {
      isChatActive.value = e.newValue ? JSON.parse(e.newValue) : false
    }
    if (e.key === 'chatWidth') {
      chatWidth.value = parseInt(e.newValue) || 320
    }
  }
  window.addEventListener('storage', storageHandler.value)

  chatWidthInterval.value = setInterval(() => {
    const storedWidth = parseInt(localStorage.getItem('chatWidth')) || 320
    if (storedWidth !== chatWidth.value) {
      chatWidth.value = storedWidth
    }
  }, 100)

  // Auto-show release notes on first load or version change
  // Check if user has already seen the current version
  setTimeout(() => {
    const currentVersion = packageJson.version
    const lastSeenVersion = localStorage.getItem('lastSeenVersion')

    // Only show if user hasn't seen this version yet
    if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
      showReleaseNotes.value = true
    }
  }, 1000)

  // Show role selection modal if user hasn't selected a role yet
  setTimeout(() => {
    if (!isRoleSelected() && localStorage.getItem('ventureOS_roleSkipped') !== 'true') {
      showRoleModal.value = true
    }
  }, 2000)
})

onUnmounted(() => {
  if (chatWidthInterval.value) {
    clearInterval(chatWidthInterval.value)
  }
  if (storageHandler.value) {
    window.removeEventListener('storage', storageHandler.value)
  }
})

watch(isSidebarActive, newVal => {
  if (newVal) bindOutsideClickListener()
  else unbindOutsideClickListener()
})

const containerClass = computed(() => {
  return {
    'layout-overlay': !hideSidebar.value && layoutConfig.menuMode === 'overlay',
    'layout-static': !hideSidebar.value && layoutConfig.menuMode === 'static',
    'layout-static-inactive':
      !hideSidebar.value &&
      layoutState.staticMenuDesktopInactive &&
      layoutConfig.menuMode === 'static',
    'layout-overlay-active': !hideSidebar.value && layoutState.overlayMenuActive,
    'layout-mobile-active': !hideSidebar.value && layoutState.staticMenuMobileActive,
    'chat-active': isChatActive.value && layoutConfig.menuMode === 'static',
    'sidebar-collapsed': !hideSidebar.value && layoutState.sidebarCollapsed,
    'no-sidebar': hideSidebar.value,
  }
})

function bindOutsideClickListener() {
  if (!outsideClickListener.value) {
    outsideClickListener.value = event => {
      if (isOutsideClicked(event)) {
        layoutState.overlayMenuActive = false
        layoutState.staticMenuMobileActive = false
        layoutState.menuHoverActive = false
      }
    }
    document.addEventListener('click', outsideClickListener.value)
  }
}

function unbindOutsideClickListener() {
  if (outsideClickListener.value) {
    document.removeEventListener('click', outsideClickListener.value)
    outsideClickListener.value = null
  }
}

function isOutsideClicked(event) {
  const sidebarEl = document.querySelector('.layout-sidebar')
  const topbarEl = document.querySelector('.layout-menu-button')

  if (!sidebarEl) return true // sidebar скрыт — всё снаружи

  return !(
    sidebarEl.isSameNode(event.target) ||
    sidebarEl.contains(event.target) ||
    topbarEl?.isSameNode(event.target) ||
    topbarEl?.contains(event.target)
  )
}

// Функция для обновления состояния чата
const updateChatState = (newState) => {
  isChatActive.value = newState
  window.localStorage.setItem('chat', JSON.stringify(newState))
}

const chatMargin = computed(() => {
  // Chat is now flush to the right edge (no padding), so margin = chat width only
  const marginInRem = chatWidth.value / 16
  return `${marginInRem}rem`
})
</script>

<template>
  <div class="layout-wrapper" :class="containerClass">
    <app-topbar @chat-toggle="updateChatState" />
    <app-sidebar v-if="!hideSidebar" />
    <!-- Suspense boundary for lazy-loaded Chat component — hidden on expert page -->
    <Transition name="slide-in-right">
      <Suspense v-if="isChatActive && route.path !== '/fst-expert'">
        <Chat />
        <template #fallback>
          <div class="chat-loading" :style="{ width: chatWidth + 'px' }"></div>
        </template>
      </Suspense>
    </Transition>
    <div class="layout-main-container" :style="isChatActive && layoutConfig.menuMode === 'static' && route.path !== '/fst-expert' ? { marginRight: chatMargin } : {}">
      <div class="layout-main">
        <router-view v-slot="{ Component, route: matchedRoute }">
            <component :is="Component" :key="matchedRoute.fullPath" />
        </router-view>
      </div>
      <app-footer />
    </div>
    <div class="layout-mask animate-fadein" @click="layoutState.staticMenuMobileActive = false; layoutState.overlayMenuActive = false"></div>
  </div>

  <Toast />
  <RoleSelectionModal v-if="showRoleModal" @role-selected="showRoleModal = false" @skipped="showRoleModal = false" />
  <ShortcutsModal />
  <!-- Session lock overlay — мгновенно закрывает контент при выходе/истечении сессии -->
  <Transition name="session-lock">
    <div v-if="isLocked" class="session-lock-overlay">
      <div class="session-lock-inner">
        <div class="session-lock-icon">
          <i :class="lockReason === 'logout' ? 'pi pi-sign-out' : 'pi pi-lock'"></i>
        </div>
        <div class="session-lock-title">
          {{ lockReason === 'logout' ? 'Выход из системы' : 'Сессия завершена' }}
        </div>
        <div class="session-lock-sub">Перенаправление на страницу входа...</div>
        <div class="session-lock-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Тонкий индикатор в окне Пескова — виден только при управлении с другого экрана -->
  <Transition name="slide-in-right">
    <div v-if="isPresentDisplay" class="present-display-badge" title="Управляется с другого экрана">
      <span class="present-display-dot"></span>
      <span class="present-display-text">LIVE DEMO</span>
      <span class="present-display-sep">·</span>
      <span class="present-display-hint">управляется событийным логом</span>
    </div>
  </Transition>
</template>

<style>
/* Unified slide animations for sidebar (left) and chat (right) */
.slide-in-right-enter-active,
.slide-in-right-leave-active,
.slide-in-left-enter-active,
.slide-in-left-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-in-right-enter-from,
.slide-in-right-leave-to {
  transform: translateX(100%);
}

.slide-in-left-enter-from,
.slide-in-left-leave-to {
  transform: translateX(-100%);
}

/* Loading placeholder for lazy-loaded Chat component */
.chat-loading {
  position: fixed;
  right: 0;
  top: 4rem;
  bottom: 0;
  background: var(--surface-card);
  border-left: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.chat-loading::after {
  content: '';
  width: 40px;
  height: 40px;
  border: 4px solid var(--primary-color);
  border-radius: 50%;
  border-top-color: transparent;
  animation: chat-spin 1s linear infinite;
}

@keyframes chat-spin {
  to { transform: rotate(360deg); }
}

/* No-sidebar layout: full width for non-admin users */
.no-sidebar .layout-main-container {
  margin-left: 0 !important;
  padding-left: 2rem;
  padding-right: 2rem;
}

/* Presentation display badge — minimal indicator in Peskov's window */
.present-display-badge {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(167, 139, 250, 0.3);
  color: rgba(255, 255, 255, 0.5);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.present-display-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  flex-shrink: 0;
  animation: present-pulse 2s ease-in-out infinite;
}
.present-display-text {
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.12em;
}
.present-display-sep {
  color: rgba(255, 255, 255, 0.25);
  font-weight: 400;
}
.present-display-hint {
  font-weight: 400;
  letter-spacing: 0;
  color: rgba(167, 139, 250, 0.7);
  font-size: 10px;
}
@keyframes present-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Session lock overlay */
.session-lock-enter-active {
  transition: opacity 0.2s ease;
}
.session-lock-leave-active {
  transition: opacity 0.4s ease;
}
.session-lock-enter-from,
.session-lock-leave-to {
  opacity: 0;
}

.session-lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-lock-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.session-lock-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.session-lock-icon i {
  font-size: 26px;
  color: rgba(255, 255, 255, 0.7);
}

.session-lock-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.session-lock-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.session-lock-dots {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.session-lock-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  animation: lock-dot-pulse 1.2s ease-in-out infinite;
}

.session-lock-dots span:nth-child(2) { animation-delay: 0.2s; }
.session-lock-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes lock-dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

</style>
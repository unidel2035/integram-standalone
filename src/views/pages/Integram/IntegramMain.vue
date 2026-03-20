<template>
  <div class="integram-main">
    <!-- Issue #6942: Menubar commented out per request - moved functionality to child pages' TopBar -->
    <!-- <Menubar :model="menuItems" class="integram-menubar">
      <template #start>
        <router-link :to="`/integram/${database}`" class="integram-brand flex align-items-center gap-2 mr-3 no-underline">
          <svg width="32" height="27" viewBox="0 0 40 34" fill="none" xmlns="http://www.w3.org/2000/svg" class="integram-logo">
            <g clip-path="url(#clip0_integram)">
              <path d="M21.0983 12.4256L19.5194 14.1254L22.2153 17.0289L13.4346 26.3889L2.28812 22.7817V11.2779L13.4346 7.67068L15.452 9.87038L17.0454 8.19038L14.1005 5L0 9.56361V24.4959L14.1005 29.0595L25.3877 17.0289L21.0983 12.4256Z" fill="currentColor"/>
              <path d="M15.4718 21.634L17.0489 19.9341L14.3548 17.0307L23.1356 7.67068L34.2802 11.2779V22.7817L23.1356 26.3889L21.1127 24.1838L19.5193 25.8656L22.4679 29.0595L36.5683 24.4977V9.56361L22.4679 5L11.1807 17.0307L15.4718 21.634Z" fill="currentColor"/>
            </g>
            <defs>
              <clipPath id="clip0_integram">
                <rect width="36.6316" height="24" fill="white" transform="translate(0 5)"/>
              </clipPath>
            </defs>
          </svg>
        </router-link>
      </template>
      <template #end>
        <div class="flex align-items-center gap-2">
          <Dropdown
            v-model="selectedDatabase"
            :options="availableDatabases"
            optionLabel="label"
            optionValue="value"
            placeholder="БД"
            @change="handleDatabaseChange"
            class="database-selector"
          >
            <template #value="slotProps">
              <div v-if="slotProps.value" class="flex align-items-center gap-2">
                <i class="pi pi-database"></i>
                <span>{{ slotProps.value }}</span>
              </div>
              <span v-else>БД</span>
            </template>
            <template #option="slotProps">
              <div class="flex align-items-center gap-2">
                <i :class="slotProps.option.icon"></i>
                <span>{{ slotProps.option.label }}</span>
                <Tag v-if="slotProps.option.isPrimary" severity="success" value="Primary" size="small" />
                <Tag v-else-if="slotProps.option.isOwned" severity="info" value="Owned" size="small" />
              </div>
            </template>
          </Dropdown>

          <Button
            icon="pi pi-question-circle"
            text
            rounded
            @click="openHelp"
            severity="secondary"
            v-tooltip.bottom="t('help')"
            aria-label="Помощь"
          />
          <Button
            icon="pi pi-user"
            text
            rounded
            @click="toggleUserMenu"
            severity="secondary"
            v-tooltip.bottom="userName"
          />
          <Menu ref="userMenu" :model="userMenuItems" popup />
        </div>
      </template>
    </Menubar> -->

    <!-- Issue #6942: New TopBar with breadcrumbs and database selector (block-editor style) -->
    <div class="integram-topbar">
      <div class="topbar-left">
        <!-- Breadcrumbs -->
        <Breadcrumb :model="breadcrumbItems" class="integram-breadcrumbs">
          <template #item="{ item, props }">
            <a
              v-if="item.route"
              class="breadcrumb-link"
              @click="router.push(item.route)"
              v-bind="props.action"
            >
              <i v-if="item.icon" :class="item.icon" class="mr-1"></i>
              <span>{{ item.label }}</span>
            </a>
            <span v-else class="breadcrumb-current" v-bind="props.action">
              <i v-if="item.icon" :class="item.icon" class="mr-1"></i>
              <span>{{ item.label }}</span>
            </span>
          </template>
          <template #separator>
            <i class="pi pi-chevron-right breadcrumb-separator"></i>
          </template>
        </Breadcrumb>
      </div>

      <div class="topbar-center">
        <!-- Database Selector (block-editor style) -->
        <div class="db-selector">
          <Dropdown
            v-model="selectedDatabase"
            :options="availableDatabases"
            optionLabel="label"
            optionValue="value"
            placeholder="БД"
            @change="handleDatabaseChange"
            class="db-dropdown"
          >
            <template #value="slotProps">
              <div v-if="slotProps.value" class="flex align-items-center gap-2">
                <i class="pi pi-database"></i>
                <span>{{ slotProps.value }}</span>
              </div>
              <span v-else>БД</span>
            </template>
            <template #option="slotProps">
              <div class="flex align-items-center gap-2">
                <i :class="slotProps.option.icon"></i>
                <span>{{ slotProps.option.label }}</span>
                <Tag v-if="slotProps.option.isPrimary" severity="success" value="Primary" size="small" />
                <Tag v-else-if="slotProps.option.isOwned" severity="info" value="Owned" size="small" />
              </div>
            </template>
          </Dropdown>
        </div>
      </div>

    </div>

    <!-- Main Content -->
    <!-- Issue #5112: Add key to force component reload when database changes -->
    <div class="content" :class="{ 'content-loading': shouldShowSwitchingOverlay }">
      <!-- Loading overlay when switching database (not shown on home page) -->
      <div v-if="shouldShowSwitchingOverlay" class="database-switch-overlay">
        <div class="switch-spinner-container">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
          <p class="mt-3 text-lg font-semibold">Переключение БД...</p>
        </div>
      </div>
      <router-view :key="database" />
    </div>

    <!-- Password Change Modal -->
    <Dialog
      v-model:visible="passwordChangeVisible"
      :header="t('passwordChange')"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="p-fluid">
        <Message v-if="passwordMessage" :severity="passwordMessageSeverity">
          {{ passwordMessage }}
        </Message>

        <div class="field">
          <label for="old-pwd">{{ t('currentPassword') }}</label>
          <Password
            id="old-pwd"
            v-model="oldPassword"
            :feedback="false"
            toggleMask
            @keyup.enter="changePassword"
          />
        </div>

        <div class="field">
          <label for="new-pwd">{{ t('newPassword') }}</label>
          <Password
            id="new-pwd"
            v-model="newPassword"
            toggleMask
            @keyup.enter="changePassword"
          />
        </div>

        <div class="field">
          <label for="new-again">{{ t('repeatPassword') }}</label>
          <Password
            id="new-again"
            v-model="newPasswordRepeat"
            :feedback="false"
            toggleMask
            @keyup.enter="changePassword"
          />
        </div>
      </div>

      <template #footer>
        <Button
          :label="t('cancel')"
          icon="pi pi-times"
          @click="passwordChangeVisible = false"
          text
        />
        <Button
          :label="t('change')"
          icon="pi pi-check"
          @click="changePassword"
          :loading="passwordChanging"
        />
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Dropdown from 'primevue/dropdown'
import Tag from 'primevue/tag'
import Breadcrumb from 'primevue/breadcrumb'
import ProgressSpinner from 'primevue/progressspinner'
import integramApiClient from '@/services/integramApiClient'
import { useIntegramBreadcrumb } from '@/composables/useIntegramBreadcrumb'
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { extraItems } = useIntegramBreadcrumb()

// Refs
const userMenu = ref()
const selectedDatabase = ref(null)
const switchingDatabase = ref(false)
// Reactive list of databases owned by the user (loaded from object/271)
const ownedDatabaseNames = ref([])
// Reactive trigger to force recompute of availableDatabases when integramApiClient.databases changes
const dbListVersion = ref(0)
const passwordChangeVisible = ref(false)
const passwordChanging = ref(false)
const passwordMessage = ref('')
const passwordMessageSeverity = ref('info')
const oldPassword = ref('')
const newPassword = ref('')
const newPasswordRepeat = ref('')
const locale = ref('ru')
const version = ref('1.0.0')

// Computed
const database = computed(() => {
  const db = route.params.database || integramApiClient.currentDatabase || integramApiClient.getDatabase() || 'my'
  console.log('[IntegramMain] database computed:', db, 'route.params:', route.params)
  return db
})
const userName = computed(() => integramApiClient.getAuthInfo().userName || 'User')

// Issue #6942: Breadcrumb items for TopBar (block-editor style)
const breadcrumbItems = computed(() => {
  const items = []
  const currentDB = database.value

  // Integram home → database selector
  items.push({
    label: 'Integram',
    icon: 'pi pi-home',
    route: '/integram'
  })

  // Current database
  if (currentDB) {
    items.push({
      label: currentDB,
      icon: 'pi pi-database',
      route: `/integram/${currentDB}/`
    })
  }

  // Section from route path (e.g. 'table' → 'Таблицы')
  const pathParts = route.path.split('/').filter(p => p)
  if (pathParts.length >= 3) {
    const section = pathParts[2]
    const menuItem = baseMenuItems.find(item => item.href === section)
    if (menuItem) {
      items.push({
        label: locale.value === 'ru' ? menuItem.ruName : menuItem.enName,
        icon: menuItem.icon,
        route: `/integram/${currentDB}/${section}`
      })
    }
  }

  // Extra items from child pages (e.g. table name)
  for (const item of extraItems.value) {
    items.push(item)
  }

  return items
})

// Check if we should show switching overlay (NOT on database home page)
const shouldShowSwitchingOverlay = computed(() => {
  // Don't show on /integram/{db}/ (home page)
  const isHomePage = route.path === `/integram/${database.value}/` || route.path === `/integram/${database.value}`
  return switchingDatabase.value && !isHomePage
})

// Issue #6656: Set of known sub-route segment names that must never be treated as DB names.
// These are child route paths under /integram/:database/. If Vue Router ever captures one
// of these as the :database param (e.g. /integram/table navigated to directly), we must
// NOT call switchDatabase() with it — doing so registers a phantom "table" entry in
// integramApiClient.databases which then pollutes the DB selector dropdown.
const INTEGRAM_SUBROUTE_NAMES = new Set([
  'dict', 'table', 'edit_types', 'edit_obj', 'object', 'sql', 'smartq',
  'report', 'requests', 'form', 'myform', 'upload', 'dir_admin', 'info',
  'api-docs', 'login'
])

// Issue #5112: Available databases for selector
// Uses reactive ownedDatabaseNames (loaded from object/271 after auth)
const availableDatabases = computed(() => {
  // Touch reactive trigger so this recomputes when databases change
  void dbListVersion.value
  const seen = new Set()
  const databases = []

  // Add currently authenticated databases from client state
  // Issue #6656: Exclude any keys that are sub-route segment names (e.g. "table", "dict")
  // which may have been erroneously registered in a previous session.
  for (const dbName of Object.keys(integramApiClient.databases)) {
    if (INTEGRAM_SUBROUTE_NAMES.has(dbName)) continue
    if (!seen.has(dbName)) {
      seen.add(dbName)
      databases.push({
        value: dbName,
        label: dbName,
        icon: 'pi pi-database',
        isPrimary: dbName === 'my',
        isOwned: false
      })
    }
  }

  // Add owned databases loaded from object/271 that are not yet in the list
  for (const dbName of ownedDatabaseNames.value) {
    if (!seen.has(dbName)) {
      seen.add(dbName)
      databases.push({
        value: dbName,
        label: dbName,
        icon: 'pi pi-th-large',
        isPrimary: false,
        isOwned: true
      })
    }
  }

  // Sort: 'my' first, then alphabetical
  return databases.sort((a, b) => {
    if (a.value === 'my') return -1
    if (b.value === 'my') return 1
    return a.value.localeCompare(b.value)
  })
})

// Base menu items configuration (legacy naming from main.html)
const baseMenuItems = [
  { href: 'dict', icon: 'pi pi-database', ruName: 'Объекты', enName: 'Objects' },
  { href: 'table', icon: 'pi pi-table', ruName: 'Таблицы', enName: 'Tables' },
  { href: 'edit_types', icon: 'pi pi-sitemap', ruName: 'Структура', enName: 'Structure' },
  { href: 'sql', icon: 'pi pi-code', ruName: 'SQL', enName: 'SQL' },
  { href: 'smartq', icon: 'pi pi-search', ruName: 'Умный запрос', enName: 'Smart Query' },
  { href: 'report', icon: 'pi pi-chart-bar', ruName: 'Запросы', enName: 'Queries' },
  { href: 'form', icon: 'pi pi-file', ruName: 'Формы', enName: 'Forms' },
  { href: 'myform', icon: 'pi pi-sliders-h', ruName: 'Мои формы', enName: 'My Forms' },
  { href: 'upload', icon: 'pi pi-upload', ruName: 'Загрузка', enName: 'Upload' },
  { href: 'dir_admin', icon: 'pi pi-folder', ruName: 'Файлы', enName: 'Files' },
  { href: 'info', icon: 'pi pi-info-circle', ruName: 'Информация', enName: 'Info' }
]

// Menu items for PrimeVue Menubar
// Issue #5112: Use database from route params
const menuItems = computed(() => {
  const currentDB = database.value
  console.log('[IntegramMain] menuItems computed, currentDB:', currentDB)
  return baseMenuItems.map(item => ({
    label: locale.value === 'ru' ? item.ruName : item.enName,
    icon: item.icon,
    command: () => {
      const url = `/integram/${currentDB}/${item.href}`
      console.log('[IntegramMain] Menu item clicked:', item.ruName, 'URL:', url, 'currentDB:', currentDB)
      router.push(url)
    }
  }))
})

// User menu items
const userMenuItems = computed(() => [
  {
    label: t('help'),
    icon: 'pi pi-question-circle',
    command: openHelp
  },
  {
    label: t('myAccount'),
    icon: 'pi pi-user',
    command: () => window.open(`/my?login=${database.value}`, '_blank')
  },
  {
    separator: true
  },
  {
    label: 'EN/RU',
    icon: 'pi pi-globe',
    command: toggleLocale
  },
  {
    label: t('changePassword'),
    icon: 'pi pi-key',
    command: showPasswordChange
  },
  {
    separator: true
  },
  {
    label: t('exit'),
    icon: 'pi pi-sign-out',
    command: logout,
    class: 'text-red-500'
  }
])

// Translations (matching main.html t9n tags)
function t(key) {
  const translations = {
    ru: {
      help: 'Помощь',
      myAccount: 'ЛК / Счет',
      changePassword: 'Сменить пароль',
      exit: 'Выход',
      passwordChange: 'Смена пароля',
      currentPassword: 'Действующий пароль',
      newPassword: 'Новый пароль',
      repeatPassword: 'Повторите пароль',
      change: 'Сменить',
      cancel: 'Отменить',
      fillAllFields: 'Заполните все поля',
      passwordsDoNotMatch: 'Пароли не совпадают',
      passwordChanged: 'Пароль успешно изменён',
      wrongPassword: 'Неверный пароль',
      more: 'Еще'
    },
    en: {
      help: 'Help',
      myAccount: 'My account',
      changePassword: 'Change Password',
      exit: 'Exit',
      passwordChange: 'Password Change',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      repeatPassword: 'Repeat Password',
      change: 'Change',
      cancel: 'Cancel',
      fillAllFields: 'Please fill in all fields',
      passwordsDoNotMatch: 'Passwords do not match',
      passwordChanged: 'Password changed successfully',
      wrongPassword: 'Wrong password',
      more: 'More'
    }
  }

  return translations[locale.value]?.[key] || key
}

// Methods
function toggleUserMenu(event) {
  userMenu.value.toggle(event)
}

function openHelp() {
  router.push('/integram/api-docs')
}

function showPasswordChange() {
  passwordChangeVisible.value = true
  oldPassword.value = ''
  newPassword.value = ''
  newPasswordRepeat.value = ''
  passwordMessage.value = ''
}

async function changePassword() {
  // Validate
  if (!oldPassword.value || !newPassword.value || !newPasswordRepeat.value) {
    passwordMessage.value = t('fillAllFields')
    passwordMessageSeverity.value = 'error'
    return
  }

  if (newPassword.value !== newPasswordRepeat.value) {
    passwordMessage.value = t('passwordsDoNotMatch')
    passwordMessageSeverity.value = 'error'
    return
  }

  passwordChanging.value = true
  passwordMessage.value = ''

  try {
    // Call Integram API to change password
    const response = await integramApiClient.post('auth?JSON', {
      change: 1,
      login: integramApiClient.getAuthInfo().userName,
      pwd: oldPassword.value,
      npw1: newPassword.value,
      npw2: newPasswordRepeat.value
    })

    if (response.msg && !response.msg.includes('[err')) {
      passwordMessage.value = t('passwordChanged')
      passwordMessageSeverity.value = 'success'

      // Update tokens if provided
      if (response.token) {
        integramApiClient.token = response.token
      }
      if (response.xsrf) {
        integramApiClient.xsrfToken = response.xsrf
      }

      // Save updated session
      integramApiClient.saveSession()

      // Close modal after success
      setTimeout(() => {
        passwordChangeVisible.value = false
        oldPassword.value = ''
        newPassword.value = ''
        newPasswordRepeat.value = ''
      }, 2000)
    } else {
      const errorMsg = response.msg ? response.msg.replace(/ ?\[.+\]/, '') : t('wrongPassword')
      passwordMessage.value = errorMsg
      passwordMessageSeverity.value = 'error'
    }
  } catch (error) {
    passwordMessage.value = error.message || t('wrongPassword')
    passwordMessageSeverity.value = 'error'
  } finally {
    passwordChanging.value = false
  }
}

function toggleLocale() {
  locale.value = locale.value === 'ru' ? 'en' : 'ru'
  // Save to localStorage
  localStorage.setItem('integram_locale', locale.value)
  // Update cookie for backend
  document.cookie = `${database.value}_locale=${locale.value};Path=/`
}

// Issue #5112: Handle database change from dropdown
async function handleDatabaseChange(event) {
  const newDatabase = event.value
  const oldDatabase = route.params.database // Use route.params, not database.value!

  switchingDatabase.value = true

  // Show loading toast
  toast.add({
    severity: 'info',
    summary: 'Переключение БД',
    detail: `Переход на "${newDatabase}"...`,
    life: 2000
  })

  try {
    await integramApiClient.switchDatabase(newDatabase)

    // Issue #5112: Always redirect to database home page when switching databases
    // This ensures components reload with correct data for the new database
    // and avoids issues with resources (tables, objects) that may not exist in the new DB
    const newPath = `/integram/${newDatabase}/`

    console.log('[handleDatabaseChange] Switching from', oldDatabase, 'to', newDatabase, 'redirecting to:', newPath)

    // Navigate and wait for completion
    await router.push(newPath)

    // Reset loading state after navigation completes
    switchingDatabase.value = false
    dbListVersion.value++
  } catch (error) {
    console.error('Failed to switch database:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message,
      life: 5000
    })
    // Revert selection
    selectedDatabase.value = oldDatabase
    switchingDatabase.value = false
  }
}

function logout() {
  integramApiClient.logout()
  document.cookie = `${database.value}=;Path=/`
  router.push('/integram/login')
}

// Load owned databases from object/271 into reactive ref so the dropdown updates
async function loadOwnedDatabases() {
  try {
    const authInfo = integramApiClient.getAuthInfo()
    if (!authInfo.userId) return

    const ownedDbs = await integramApiClient.getOwnedDatabases(authInfo.userId)
    if (Array.isArray(ownedDbs) && ownedDbs.length > 0) {
      ownedDatabaseNames.value = ownedDbs
      // Also store in databases['my'] so other parts of the app can use it
      if (integramApiClient.databases['my']) {
        integramApiClient.databases['my'].ownedDatabases = ownedDbs
      }
      integramApiClient.saveSession()
      dbListVersion.value++
    }
  } catch (err) {
    console.warn('[IntegramMain] Failed to load owned databases:', err)
  }
}

// Issue #5112: Watch route params to sync dropdown selection
// Issue #6656: Guard against sub-route names (e.g. "table", "dict") being captured as
// the :database param — that would register them as phantom databases in the client.
const mountedDone = ref(false)
watch(() => route.params.database, async (newDb) => {
  if (!mountedDone.value) return // wait for onMounted auto-login first
  if (newDb && newDb !== selectedDatabase.value) {
    // Skip if the param value is actually a known sub-route segment, not a real DB name
    if (INTEGRAM_SUBROUTE_NAMES.has(newDb)) {
      console.warn(`[IntegramMain] Skipping switchDatabase('${newDb}'): value is a sub-route segment, not a database name`)
      return
    }
    selectedDatabase.value = newDb
    try {
      await integramApiClient.switchDatabase(newDb)
    } catch (error) {
      console.warn('Failed to switch database from route change:', error)
    }
  }
})

// Lifecycle
onMounted(async () => {
  // Issue #5100: Try to restore session before checking auth
  integramApiClient.tryRestoreSession()

  // Issue #6591: Always try to load my_token from localStorage.
  // Even if we have a saved integram_session, databases['my'].token may be stale
  // (e.g. user re-authenticated on the main site since the session was saved).
  // loadSessionFromMyToken() now syncs the token unconditionally when my_token exists.
  integramApiClient.loadSessionFromMyToken()
  let authInfo = integramApiClient.getAuthInfo()

  // Issue #4168: Check Integram authentication (independent from main site auth)
  // Auto-login for known databases — always try, even if old token exists
  const AUTO_CREDENTIALS = {
      nous: { login: 'nous', password: 'dow8h73w' },
      kval: { login: 'd', password: 'd' },
      fst: { login: 'd', password: 'd' },
      my: { login: 'd', password: 'd' },
    }
    const db = database.value
    const creds = AUTO_CREDENTIALS[db]
    if (creds) {
      try {
        console.log(`[IntegramMain] Auto-login to ${db}...`)
        await integramApiClient.authenticate(db, creds.login, creds.password)
        authInfo = integramApiClient.getAuthInfo()
        console.log(`[IntegramMain] Auto-login to ${db} OK: ${authInfo.userName}`)
      } catch (e) {
        console.warn(`[IntegramMain] Auto-login to ${db} failed:`, e.message)
      }
    }
    // If still no auth after auto-login — only redirect for unknown databases
    if (!authInfo.token || !authInfo.xsrf) {
      if (!creds) {
        const currentPath = route.fullPath
        if (currentPath !== '/integram' && currentPath !== '/integram/') {
          router.push(`/integram/login?redirect=${encodeURIComponent(currentPath)}`)
        } else {
          router.push('/integram/login')
        }
        return
      }
      // For known databases, continue anyway — auto-login may still be processing
      console.warn(`[IntegramMain] No token for ${db} after auto-login, continuing anyway`)
    }

  // Issue #5100: Validate session to refresh tokens and prevent quick expiration
  // Skip validation if we just auto-logged in (fresh token, no need to validate)
  const AUTO_CREDENTIALS_KEYS = ['nous', 'kval', 'fst', 'my']
  const justAutoLoggedIn = AUTO_CREDENTIALS_KEYS.includes(database.value) && authInfo.token
  if (!justAutoLoggedIn) {
    const sessionValid = await integramApiClient.validateSession()
    if (!sessionValid) {
      console.warn('[IntegramMain] Session validation failed, redirecting to integram login')
      integramApiClient.logout()
      const currentPath = route.fullPath
      if (currentPath !== '/integram' && currentPath !== '/integram/') {
        router.push(`/integram/login?redirect=${encodeURIComponent(currentPath)}`)
      } else {
        router.push('/integram/login')
      }
      return
    }
  }

  // Load list of databases accessible to this user (for dropdown)
  dbListVersion.value++
  loadOwnedDatabases()

  // Load locale from localStorage - default to ru if not set
  const savedLocale = localStorage.getItem('integram_locale')
  if (savedLocale) {
    // Normalize to lowercase for consistency
    locale.value = savedLocale.toLowerCase()
  } else {
    // Issue #5100: Default to ru if no saved locale
    locale.value = 'ru'
    localStorage.setItem('integram_locale', 'ru')
  }

  // Signal watcher that mount + auto-login is done
  selectedDatabase.value = database.value
  mountedDone.value = true
})
</script>

<style scoped>
.integram-main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.integram-menubar {
  position: sticky;
  top: 0;
  z-index: 1000;
}

.integram-brand {
  text-decoration: none !important;
  transition: opacity 0.2s;
  align-items: center;
}

.integram-brand:hover {
  opacity: 0.8;
}

.integram-logo {
  color: var(--p-primary-color, var(--primary-color));
  flex-shrink: 0;
}

.content {
  flex: 1;
  padding: 1rem;
min-height: calc(100vh - 150px);
  position: relative;
}

.content-loading {
  pointer-events: none;
  opacity: 0.6;
}

/* Database switch overlay */
.database-switch-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.switch-spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--surface-card);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.footer {
  background-color: var(--surface-100);
  border-top: 1px solid var(--surface-border);
  margin-top: auto;
  padding: 1rem;
}

.text-muted {
  color: var(--text-color-secondary);
}

/* TopBar styles (block-editor style) - fixed position in topbar area */
.integram-topbar {
  position: fixed;
  top: 0;
  left: 20rem; /* After sidebar width */
  right: 22rem; /* Leave space for AppTopbar actions (bell/chat/user/lang) */
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  background: transparent;
  z-index: 998; /* Below topbar (997) but above content */
  pointer-events: none;
  gap: 1rem;
}

/* Enable pointer events on topbar children */
.integram-topbar > * {
  pointer-events: auto;
}

/* Adjust for collapsed / hidden sidebar — matches block-editor */
.sidebar-collapsed .integram-topbar,
:root:has(.sidebar-collapsed) .integram-topbar,
.layout-static-inactive .integram-topbar,
:root:has(.layout-static-inactive) .integram-topbar {
  left: 4.5rem;
}

.topbar-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Breadcrumbs styling (block-editor style) */
.integram-breadcrumbs {
  background: transparent;
  padding: 0;
  border: none;
}

.integram-breadcrumbs :deep(.p-breadcrumb-list) {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: nowrap;
}

.integram-breadcrumbs :deep(.p-breadcrumb-item) {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

/* Base breadcrumb styles — match block-editor */
.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--primary-color);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-size: 0.8125rem;
}

.breadcrumb-link:hover {
  background: var(--p-highlight-background);
  color: var(--primary-color);
  text-decoration: none;
}

.breadcrumb-link i {
  font-size: 0.75rem;
  opacity: 0.8;
}

.breadcrumb-current {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-color-secondary);
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  cursor: default;
}

.breadcrumb-current i {
  font-size: 0.75rem;
  opacity: 0.6;
}

.breadcrumb-separator {
  font-size: 0.625rem;
  color: var(--text-color-secondary);
  opacity: 0.5;
  margin: 0 0.125rem;
}

/* Integram-specific size overrides — match doc-breadcrumbs-inline in block-editor */
.integram-breadcrumbs .breadcrumb-link {
  font-size: 1rem;
  font-weight: 500;
}

.integram-breadcrumbs .breadcrumb-current {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.integram-breadcrumbs .breadcrumb-separator {
  font-size: 0.75rem;
  margin: 0 0.25rem;
  opacity: 0.5;
}

/* Database selector (block-editor style) */
.db-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.db-dropdown {
  min-width: 100px;
  width: auto;
}

.db-dropdown :deep(.p-dropdown-label) {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.db-dropdown :deep(.p-dropdown) {
  border: none;
  background: transparent;
}

.db-dropdown :deep(.p-dropdown:hover) {
  background: var(--surface-hover);
  border-radius: var(--border-radius);
}

/* Responsive adjustments */
@media (max-width: 991px) {
  /* Issue #6946: On mobile/tablet, sidebar is hidden so left: 0 */
  .integram-topbar {
    left: 0;
    padding: 0 0.5rem;
    gap: 0.5rem;
  }
}

@media (max-width: 768px) {
  .topbar-left {
    flex: 1;
    min-width: 0;
  }

  .topbar-center {
    display: none; /* Hide database selector on mobile for space */
  }

  .topbar-right {
    flex-shrink: 0;
  }
}
</style>

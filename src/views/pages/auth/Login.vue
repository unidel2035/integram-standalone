<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '@/axios2'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { clearUserCache } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { getSafeRedirectUrl } from '@/utils/redirectValidation'
import { getDefaultToken } from '@/services/tokenService'

// Initialize auth store with null-check to prevent Pinia initialization errors (Issue #5216)
let authStore = null
try {
  authStore = useAuthStore()
} catch (error) {
  console.warn('[Login] Pinia not ready, deferring authStore initialization to onMounted:', error.message)
  // Store will be initialized in onMounted - this is expected during initial page load
}

const route = useRoute()
const email = ref('')
const password = ref('')
const apiBase = ref(window.location.hostname) // Значение по умолчанию
const showApiBaseInput = ref(false) // Флаг для отображения/скрытия поля API Base
const database = ref('my') // Для хранения выбранной базы данных (DEFAULT: my)
const isLoading = ref(false)
const errorMessage = ref('')
const router = useRouter()
const toast = useToast()

// OAuth loading states
const oauthLoading = ref({
  yandex: false,
  vk: false,
  google: false,
  telegram: false,
})

// API URL for OAuth
const AUTH_API_URL = '/api/auth'

// Опции для выпадающего списка API Base
const apiBaseOptions = ref([
  { label: 'dronedoc.ru', value: 'dronedoc.ru' },
  { label: 'sim.sakhwings.ru', value: 'sim.sakhwings.ru' },
  { label: 'app.integram.io', value: 'app.integram.io' },
  { label: 'localhost', value: 'localhost' },
])

// Функция для получения cookie по имени
const getCookie = name => {
  // console.log(name)
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
}

// Проверяем cookies и URL параметры при загрузке компонента
onMounted(() => {
  // Ensure authStore is initialized (fallback if initial initialization failed)
  if (!authStore) {
    try {
      authStore = useAuthStore()
    } catch (error) {
      console.warn('[Login] Pinia still not ready in onMounted:', error.message)
      toast.add({
        severity: 'warn',
        summary: 'Инициализация...',
        detail: 'Система авторизации инициализируется. Пожалуйста, подождите.',
        life: 3000
      })
      return
    }
  }

  // console.log('dd')
  // Issue #3875: DO NOT clear localStorage on mount!
  // This was causing tokens to be deleted after successful login when user is redirected.
  // The Login component may still be mounted during redirect, causing token deletion.
  // Only clear auth data when user explicitly logs out (handled in authStore.logout()).

  // localStorage.removeItem('_xsrf')  // REMOVED
  // localStorage.removeItem('token')  // REMOVED
  // localStorage.removeItem('user')   // REMOVED
  // localStorage.removeItem('id')     // REMOVED
  // clearUserCache()                  // REMOVED

  // Проверяем наличие GET-параметра api
  const urlParams = new URLSearchParams(window.location.search)
  const apiParam = urlParams.get('api')

  if (apiParam) {
    // Если передан параметр api, показываем поле и устанавливаем значение
    showApiBaseInput.value = true
    apiBase.value = apiParam
  } else {
    // Иначе загружаем сохраненный apiBase из localStorage
    const savedApiBase = localStorage.getItem('apiBase')
    if (savedApiBase) apiBase.value = savedApiBase
  }

  // Загружаем сохраненную базу данных из localStorage
  const savedDatabase = localStorage.getItem('db')
  if (savedDatabase) database.value = savedDatabase

  const cookiesToCheck = ['_xsrf', 'token', 'id', 'user']
  const hasAllCookies = cookiesToCheck.every(cookie => getCookie(cookie))
  if (hasAllCookies) {
    // Копируем значения из cookies в localStorage
    cookiesToCheck.forEach(cookie => {
      // console.log(cookie)
      localStorage.setItem(cookie, getCookie(cookie))
    })

    // Issue #5005: Save session timestamp for expiration validation
    localStorage.setItem('session_timestamp', Date.now().toString())

    // Удаляем cookies
    cookiesToCheck.forEach(cookie => {
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })

    // Перенаправляем на главную страницу вместо перезагрузки
    router.push('/')
  }
})

const handleSubmit = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    // Ensure authStore is initialized (Issue #5216)
    if (!authStore) {
      try {
        authStore = useAuthStore()
      } catch (error) {
        errorMessage.value = 'Ошибка инициализации системы авторизации. Пожалуйста, обновите страницу.'
        toast.add({
          severity: 'error',
          summary: 'Ошибка',
          detail: errorMessage.value,
          life: 5000
        })
        isLoading.value = false
        return
      }
    }

    // Определяем apiBase и database
    // Issue #3806: Use apiBase.value which is loaded from localStorage or URL param,
    // not hardcoded 'dronedoc.ru' when input is hidden
    const finalApiBase = apiBase.value || window.location.hostname
    const finalDatabase = database.value || 'my' // DEFAULT: my

    // Use auth store for multi-database authentication
    // This will authenticate to both the selected database AND ddadmin
    await authStore.login(email.value, password.value, finalApiBase, finalDatabase)

    // Clear user cache after login to force fresh data fetch
    clearUserCache()

    // Fetch default token to show balance in welcome message
    let tokenBalance = null
    try {
      const userToken = localStorage.getItem('token') || authStore.token
      if (userToken) {
        const tokenData = await getDefaultToken(userToken)
        tokenBalance = tokenData.token?.token_balance
      }
    } catch (tokenError) {
      console.warn('Failed to fetch token balance:', tokenError)
      // Non-critical error, continue with login flow
    }

    // Show welcome toast with token balance if available
    toast.add({
      severity: 'success',
      summary: 'Добро пожаловать!',
      detail: tokenBalance
        ? `Ваш баланс: ${tokenBalance.toLocaleString('ru-RU')} токенов. Вы можете использовать AI модели бесплатно!`
        : 'Вы успешно вошли в систему',
      life: 5000,
    })

    // Redirect to original destination or default to /welcome
    // Issue #3786: Validate redirect URL to prevent open redirect and XSS
    // Issue #3788: Properly await router.push to ensure navigation completes
    // Issue #5112: Changed default redirect from /dash to /welcome
    const redirectUrl = getSafeRedirectUrl(route.query.redirect, '/welcome')

    try {
      await router.push(redirectUrl)
    } catch (navigationError) {
      // Handle navigation errors (e.g., navigation cancelled, route not found)
      console.error('Navigation error after login:', navigationError)

      // If redirect URL fails, try fallback to /welcome
      if (redirectUrl !== '/welcome') {
        console.warn('Redirect URL failed, trying fallback /welcome')
        await router.push('/welcome')
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
    errorMessage.value = 'Неверный логин или пароль'

    toast.add({
      severity: 'error',
      summary: 'Ошибка входа',
      detail: 'Неверный логин или пароль',
      life: 3000,
    })
  } finally {
    isLoading.value = false
  }
}

// Telegram Login Widget callback
// This function is called by the Telegram widget when user authorizes
const onTelegramAuth = async (telegramUser) => {
  oauthLoading.value.telegram = true

  try {
    // Send Telegram auth data to backend
    const response = await axios.post(`${AUTH_API_URL}/oauth/telegram`, telegramUser)

    if (response.data.success) {
      const { userId, username, displayName, accessToken, refreshToken, token, _xsrf } = response.data.data

      // Save tokens to localStorage
      if (accessToken) localStorage.setItem('accessToken', accessToken)
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
      if (token) localStorage.setItem('token', token)
      if (_xsrf) localStorage.setItem('_xsrf', _xsrf)
      if (userId) localStorage.setItem('id', userId.toString())

      // Issue #5139: Save user for router session validation
      // Router checks accessToken + user for OAuth sessions
      const userName = displayName || username || `tg_${userId}`
      localStorage.setItem('user', userName)

      // Issue #5005: Save session timestamp
      localStorage.setItem('session_timestamp', Date.now().toString())

      // Clear user cache and redirect
      clearUserCache()

      toast.add({
        severity: 'success',
        summary: 'Добро пожаловать!',
        detail: 'Вы успешно вошли через Telegram',
        life: 3000,
      })

      // Use window.location for reliable redirect after Telegram widget auth
      const redirectUrl = getSafeRedirectUrl(route.query.redirect, '/welcome')
      window.location.href = redirectUrl
    }
  } catch (error) {
    console.error('Telegram auth error:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка авторизации',
      detail: error.response?.data?.error || 'Не удалось войти через Telegram',
      life: 3000,
    })
  } finally {
    oauthLoading.value.telegram = false
  }
}

// Make callback available globally for Telegram widget
if (typeof window !== 'undefined') {
  window.onTelegramAuth = onTelegramAuth
}

// Initialize Telegram Login Widget
const initTelegramWidget = () => {
  // Remove existing widget if any
  const existingWidget = document.getElementById('telegram-login-widget')
  if (existingWidget) existingWidget.remove()

  // Create widget container
  const container = document.getElementById('telegram-widget-container')
  if (!container) return

  // Create Telegram widget script
  const script = document.createElement('script')
  script.id = 'telegram-login-widget'
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.setAttribute('data-telegram-login', 'dd_login_bot')
  script.setAttribute('data-size', 'large')
  script.setAttribute('data-radius', '10')
  script.setAttribute('data-onauth', 'onTelegramAuth(user)')
  script.setAttribute('data-request-access', 'write')
  script.async = true

  container.appendChild(script)
}

// Start Telegram auth - initialize widget
const startTelegramAuth = () => {
  // Initialize Telegram Login Widget in place
  initTelegramWidget()

  toast.add({
    severity: 'info',
    summary: 'Telegram',
    detail: 'Нажмите на кнопку "Log in with Telegram" ниже',
    life: 3000,
  })
}

// Функция для переключения видимости поля API Base
const toggleApiBaseInput = () => {
  showApiBaseInput.value = !showApiBaseInput.value
}

// Вычисляемое свойство для отображения поля базы данных
const showDatabaseInput = () => {
  return showApiBaseInput.value
}

// OAuth handlers
const handleOAuthLogin = async (provider) => {
  oauthLoading.value[provider] = true

  try {
    const response = await axios.get(`${AUTH_API_URL}/oauth/${provider}`)

    if (response.data.success) {
      // Redirect to OAuth provider
      window.location.href = response.data.data.authUrl
    }
  } catch (error) {
    console.error(`${provider} OAuth error:`, error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка авторизации',
      detail: `Не удалось подключиться к ${provider}`,
      life: 3000,
    })
    oauthLoading.value[provider] = false
  }
}
</script>

<template>
  <Toast />
  <div
    class="bg-surface-50 dark:bg-surface-950"
    style="display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden;">
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="
          border-radius: 56px;
          padding: 0.3rem;
          background: linear-gradient(
            180deg,
            var(--primary-color) 10%,
            rgba(33, 150, 243, 0) 30%
          );
        ">
        <div class="w-full bg-surface-0 dark:bg-surface-900" style="border-radius: 53px; width: 450px; padding: 2rem 2.5rem;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <div class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-1">Вход в систему</div>
            <span class="text-muted-color text-sm">Войдите, чтобы продолжить</span>
          </div>

          <div>
            <form @submit.prevent="handleSubmit">
              <!-- Кнопка для показа/скрытия поля API Base -->
              <div class="mb-4 flex justify-end">
                <Button type="button" icon="pi pi-cog" class="p-button-text p-button-sm" @click="toggleApiBaseInput"
                  title="'Настройки API'" />
              </div>

              <InputText id="email1" type="text" placeholder="Логин" class="w-full mb-3" v-model="email" />
              <Password id="password1" v-model="password" placeholder="Пароль" :toggleMask="true" class="mb-3" fluid
                :feedback="false"/>

              <!-- Добавлен отступ сверху для поля выбора API сервера -->
              <div v-if="showApiBaseInput" class="mt-3">
                <label for="apiBase" class="block text-surface-900 dark:text-surface-0 text-sm font-medium mb-1">
                  Сервер API
                </label>
                <Dropdown id="apiBase" v-model="apiBase" :options="apiBaseOptions" optionLabel="label"
                  optionValue="value" placeholder="Выберите сервер API" class="w-full" />
              </div>

              <!-- Поле для выбора базы данных -->
              <div v-if="showDatabaseInput()" class="mt-3">
                <label for="database" class="block text-surface-900 dark:text-surface-0 text-sm font-medium mb-1">
                  База данных (по умолчанию: my)
                </label>
                <InputText id="database" type="text" placeholder="my"
                  class="w-full" v-model="database" />
              </div>

              <Button label="Войти" class="w-full mt-4" type="submit" :loading="isLoading" />

              <div v-if="errorMessage" class="mt-4 text-red-500 text-center">
                {{ errorMessage }}
              </div>
            </form>
          </div>
          <!-- OAuth Section -->
          <div class="mt-4">
            <div class="divider">
              <span>или войти через</span>
            </div>

            <div class="oauth-buttons-row">
              <!-- Яндекс -->
              <button @click="handleOAuthLogin('yandex')" :disabled="oauthLoading.yandex"
                class="oauth-btn oauth-yandex" type="button" title="Яндекс">
                <svg v-if="!oauthLoading.yandex" class="oauth-icon oauth-icon-lg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.14 7.88h-.57c-.81 0-1.35.41-1.35 1.16 0 .66.32 1.05 1.19 1.6l.72.46-2.16 3.4H10.4l1.85-2.91c-1.13-.77-1.73-1.57-1.73-2.7 0-1.54 1.13-2.7 2.96-2.7h2.24v8.32h-1.58V7.88z" fill="currentColor"/>
                </svg>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>

              <!-- Google -->
              <button @click="handleOAuthLogin('google')" :disabled="oauthLoading.google"
                class="oauth-btn oauth-google" type="button" title="Google">
                <svg v-if="!oauthLoading.google" class="oauth-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>

              <!-- ВКонтакте -->
              <button @click="handleOAuthLogin('vk')" :disabled="oauthLoading.vk"
                class="oauth-btn oauth-vk" type="button" title="ВКонтакте">
                <svg v-if="!oauthLoading.vk" class="oauth-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M25.54 34.58c-10.94 0-17.18-7.5-17.44-19.98h5.48c.18 9.16 4.22 13.04 7.42 13.84V14.6h5.16v7.9c3.16-.34 6.48-3.94 7.6-7.9h5.16c-.86 4.88-4.46 8.48-7.02 9.96 2.56 1.2 6.66 4.36 8.22 10.02h-5.68c-1.22-3.8-4.26-6.74-8.28-7.14v7.14h-.62z" fill="currentColor"/>
                </svg>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>

              <!-- Telegram -->
              <button @click="startTelegramAuth" :disabled="oauthLoading.telegram"
                class="oauth-btn oauth-telegram" type="button" title="Telegram">
                <svg v-if="!oauthLoading.telegram" class="oauth-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill="currentColor"/>
                </svg>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>
            </div>

            <!-- Telegram Widget Container -->
            <div id="telegram-widget-container" class="telegram-widget-container"></div>
          </div>

          <div class="text-center mt-4">
            <span class="text-muted-color text-sm">Нет аккаунта? </span>
            <router-link to="/register" class="text-primary font-semibold no-underline hover:underline">
              Зарегистрируйтесь здесь
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pi-eye {
  transform: scale(1.6);
  margin-right: 1rem;
}

.pi-eye-slash {
  transform: scale(1.6);
  margin-right: 1rem;
}

.svg-container {
  display: grid;
  place-items: center;
}

.text-muted-color {
  color: var(--text-color-secondary);
}

.hover\:underline:hover {
  text-decoration: underline;
}

/* OAuth Section Styles */
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 0.5rem 0;
  color: var(--text-color-secondary);
  font-size: 0.75rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--surface-200);
}

.divider span {
  padding: 0 0.5rem;
}

/* OAuth buttons row */
.oauth-buttons-row {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

/* Square OAuth button */
.oauth-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
}

.oauth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.oauth-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.oauth-icon {
  width: 24px;
  height: 24px;
}

.oauth-icon-lg {
  width: 28px;
  height: 28px;
}

/* Яндекс */
.oauth-yandex {
  background: #FC3F1D;
}

.oauth-yandex:hover:not(:disabled) {
  background: #E53517;
}

/* Google */
.oauth-google {
  background: #fff;
  border: 1px solid #e0e0e0;
}

.oauth-google:hover:not(:disabled) {
  background: #f5f5f5;
}

/* ВКонтакте */
.oauth-vk {
  background: #0077FF;
}

.oauth-vk:hover:not(:disabled) {
  background: #0066DD;
}

/* Telegram */
.oauth-telegram {
  background: #0088CC;
}

.oauth-telegram:hover:not(:disabled) {
  background: #0077B5;
}

/* Telegram Widget Container */
.telegram-widget-container {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  min-height: 0;
  transition: min-height 0.3s ease;
}

.telegram-widget-container:not(:empty) {
  min-height: 50px;
}

/* Dark mode support */
.dark .divider::before,
.dark .divider::after {
  border-bottom-color: var(--surface-700);
}

.dark .oauth-google {
  background: #fff;
  border-color: transparent;
}
</style>


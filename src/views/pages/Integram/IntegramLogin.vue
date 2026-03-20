<template>
  <div class="integram-login-page flex align-items-center justify-content-center min-h-screen">
    <div class="surface-card p-5 shadow-2 border-round" style="max-width: 480px; width: 100%;">
      <!-- Header -->
      <div class="flex align-items-center mb-4 gap-2">
        <svg width="40" height="34" viewBox="0 0 40 34" fill="none" xmlns="http://www.w3.org/2000/svg" class="integram-logo flex-shrink-0">
          <g clip-path="url(#clip0_login)">
            <path d="M21.0983 12.4256L19.5194 14.1254L22.2153 17.0289L13.4346 26.3889L2.28812 22.7817V11.2779L13.4346 7.67068L15.452 9.87038L17.0454 8.19038L14.1005 5L0 9.56361V24.4959L14.1005 29.0595L25.3877 17.0289L21.0983 12.4256Z" fill="currentColor"/>
            <path d="M15.4718 21.634L17.0489 19.9341L14.3548 17.0307L23.1356 7.67068L34.2802 11.2779V22.7817L23.1356 26.3889L21.1127 24.1838L19.5193 25.8656L22.4679 29.0595L36.5683 24.4977V9.56361L22.4679 5L11.1807 17.0307L15.4718 21.634Z" fill="currentColor"/>
          </g>
          <defs>
            <clipPath id="clip0_login">
              <rect width="36.6316" height="24" fill="white" transform="translate(0 5)"/>
            </clipPath>
          </defs>
        </svg>
        <span class="text-2xl font-semibold">Integram</span>
      </div>

      <!-- Authenticated databases section (if logged in via /login) -->
      <div v-if="isAuthenticated && authenticatedDatabases.length > 0" class="mb-4">
        <div class="db-category-card mb-3">
          <div class="category-header">
            <i class="pi pi-check-circle"></i>
            <span>Активные базы данных</span>
          </div>
          <div class="flex flex-wrap gap-2 justify-content-center">
            <Button
              v-for="db in authenticatedDatabases"
              :key="db.name"
              :label="db.name"
              severity="success"
              outlined
              @click="enterDatabase(db.name)"
            >
              <template #icon><i class="pi pi-database mr-2"></i></template>
            </Button>
          </div>
        </div>

        <div v-if="ownedDatabases.length > 0" class="db-category-card">
          <div class="category-header secondary">
            <i class="pi pi-server"></i>
            <span>Доступные базы данных</span>
          </div>
          <div class="flex flex-wrap gap-2 justify-content-center">
            <Button
              v-for="dbName in ownedDatabases"
              :key="dbName"
              :label="dbName"
              size="small"
              outlined
              @click="enterDatabase(dbName)"
            >
              <template #icon><i class="pi pi-database mr-2"></i></template>
            </Button>
          </div>
        </div>

        <Divider />
      </div>

      <!-- Not authenticated: redirect to main login -->
      <div v-if="!isAuthenticated" class="text-center">
        <p class="mb-4 text-color-secondary">Для доступа к Integram необходимо войти в систему.</p>
        <Button
          label="Войти через DronDoc"
          icon="pi pi-sign-in"
          class="w-full"
          @click="goToMainLogin"
        />
      </div>

      <!-- Authenticated but no databases -->
      <div v-else-if="authenticatedDatabases.length === 0" class="text-center">
        <p class="mb-3 text-color-secondary">Загрузка данных...</p>
        <Button label="Перейти к базам данных" icon="pi pi-database" class="w-full" @click="goToSelector" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import integramApiClient from '@/services/integramApiClient'
import { getSafeRedirectUrl } from '@/utils/redirectValidation'
import Button from 'primevue/button'
import Divider from 'primevue/divider'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const isAuthenticated = ref(false)

const authenticatedDatabases = computed(() => {
  const dbs = []
  for (const [dbName, dbSession] of Object.entries(integramApiClient.databases)) {
    dbs.push({ name: dbName, userName: dbSession.userName, userRole: dbSession.userRole })
  }
  return dbs.sort((a, b) => (a.name === 'my' ? -1 : b.name === 'my' ? 1 : a.name.localeCompare(b.name)))
})

const ownedDatabases = computed(() => {
  const mySession = integramApiClient.databases['my']
  if (!mySession?.ownedDatabases) return []
  return mySession.ownedDatabases.filter(dbName => !integramApiClient.databases[dbName])
})

async function enterDatabase(dbName) {
  try {
    await integramApiClient.switchDatabase(dbName)
    const defaultRedirect = `/integram/${dbName}/`
    const redirectUrl = getSafeRedirectUrl(route.query.redirect, defaultRedirect)
    router.push(redirectUrl)
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: err.message, life: 5000 })
  }
}

function goToMainLogin() {
  const redirect = route.query.redirect || '/integram'
  router.push(`/login?redirect=${encodeURIComponent(redirect)}`)
}

function goToSelector() {
  router.push('/integram')
}

onMounted(async () => {
  // Try to restore session from main /login credentials
  integramApiClient.tryRestoreSession()

  const token = localStorage.getItem('token')
  if (!token) {
    // Not authenticated via main site — redirect to /login
    const redirect = route.query.redirect || route.fullPath
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
    return
  }

  // User has a token from main /login — set up integram session
  if (!integramApiClient.databases['my']) {
    const loaded = integramApiClient.loadSessionFromMyToken()
    if (loaded) {
      const userId = localStorage.getItem('id')
      if (userId) {
        try {
          const ownedDatabases = await integramApiClient.getOwnedDatabases(userId)
          integramApiClient.databases['my'].ownedDatabases = ownedDatabases
          integramApiClient.saveSession()
        } catch (e) {
          console.warn('[IntegramLogin] Failed to load owned databases:', e.message)
        }
      }
    }
  }

  isAuthenticated.value = true

  // If we have an explicit redirect, navigate there — but only after validating the session.
  // Issue #6611: Without validation, a stale kval/tech token loaded from localStorage
  // causes an infinite loop: IntegramMain fails validation → logout → redirect to login →
  // IntegramLogin loads same stale token → auto-redirects back → IntegramMain fails again.
  if (route.query.redirect && authenticatedDatabases.value.length > 0) {
    // Issue #6611: Validate access to the SPECIFIC target database, not just 'my'.
    // The user may have a valid 'my' session but no access to e.g. 'tech' database.
    // Without this check: IntegramMain fails tech/xsrf → logout → redirect to login →
    // IntegramLogin sees valid my_token → validateSession() checks my/xsrf → OK →
    // auto-redirect to tech → IntegramMain fails again → infinite loop.
    const redirectPath = route.query.redirect
    const dbMatch = String(redirectPath).match(/^\/integram\/([^/]+)/)
    const targetDb = dbMatch ? dbMatch[1] : null

    if (targetDb && targetDb !== 'login') {
      // Switch context to target database so validateSession() tests access there
      try {
        await integramApiClient.switchDatabase(targetDb)
      } catch (e) {
        // Cannot switch to target database — stay on login page
        return
      }
    }

    const sessionValid = await integramApiClient.validateSession()
    if (sessionValid) {
      const redirectUrl = getSafeRedirectUrl(redirectPath, '/integram')
      router.replace(redirectUrl)
    } else {
      // Session is stale or target database is not accessible — clear and show login
      integramApiClient.logout()
      isAuthenticated.value = false
    }
  }
})
</script>

<style scoped>
.integram-login-page {
  background: var(--surface-ground);
  padding: 1rem;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.integram-logo {
  color: var(--p-primary-color, var(--primary-color));
}

.db-category-card {
  padding: 0;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, var(--p-green-400, #4ade80) 0%, var(--p-green-600, #16a34a) 100%);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.category-header.secondary {
  background: linear-gradient(135deg, var(--p-blue-400, #60a5fa) 0%, var(--p-blue-500, #3b82f6) 100%);
}
</style>

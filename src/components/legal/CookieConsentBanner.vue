<template>
  <Transition name="slide-up">
    <div v-if="showBanner" class="cookie-consent-banner">
      <div class="cookie-content">
        <div class="cookie-icon">
          <i class="pi pi-info-circle"></i>
        </div>
        <div class="cookie-text">
          <h3>Мы используем cookies</h3>
          <p>
            Наш сайт использует файлы cookies для улучшения работы и персонализации сервиса.
            Продолжая использовать сайт, вы соглашаетесь с нашей
            <router-link to="/legal/cookie-policy" class="cookie-link">Политикой использования cookies</router-link>.
          </p>
        </div>
        <div class="cookie-actions">
          <Button label="Настроить" class="p-button-outlined p-button-sm" @click="openSettings" />
          <Button label="Принять всё" class="p-button-sm" @click="acceptAll" />
          <Button label="Только необходимые" class="p-button-text p-button-sm" @click="acceptEssential" />
        </div>
      </div>
    </div>
  </Transition>

  <!-- Cookie Settings Dialog -->
  <Dialog v-model:visible="showSettings" header="Настройки cookies" :modal="true" :style="{ width: '600px' }" :breakpoints="{ '960px': '90vw' }">
    <div class="cookie-settings">
      <div class="cookie-category">
        <div class="flex items-center justify-between mb-2">
          <h4>Необходимые cookies</h4>
          <InputSwitch v-model="cookiePreferences.essential" disabled />
        </div>
        <p class="text-sm text-muted-color">
          Эти cookies необходимы для работы сайта и не могут быть отключены.
          Они обеспечивают безопасность, аутентификацию и базовые функции.
        </p>
      </div>

      <Divider />

      <div class="cookie-category">
        <div class="flex items-center justify-between mb-2">
          <h4>Функциональные cookies</h4>
          <InputSwitch v-model="cookiePreferences.functional" />
        </div>
        <p class="text-sm text-muted-color">
          Эти cookies позволяют запоминать ваш выбор (например, язык интерфейса, тему оформления)
          и предоставлять улучшенные функции.
        </p>
      </div>

      <Divider />

      <div class="cookie-category">
        <div class="flex items-center justify-between mb-2">
          <h4>Аналитические cookies</h4>
          <InputSwitch v-model="cookiePreferences.analytics" />
        </div>
        <p class="text-sm text-muted-color">
          Эти cookies помогают нам понимать, как пользователи взаимодействуют с сайтом.
          Все данные анонимизируются и используются для улучшения сервиса.
        </p>
      </div>

      <Divider />

      <div class="cookie-category">
        <div class="flex items-center justify-between mb-2">
          <h4>Маркетинговые cookies</h4>
          <InputSwitch v-model="cookiePreferences.marketing" />
        </div>
        <p class="text-sm text-muted-color">
          Эти cookies используются для показа персонализированной рекламы.
          В данный момент мы не используем маркетинговые cookies.
        </p>
      </div>
    </div>

    <template #footer>
      <Button label="Отменить" class="p-button-text" @click="showSettings = false" />
      <Button label="Сохранить настройки" @click="savePreferences" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const showBanner = ref(false)
const showSettings = ref(false)

const cookiePreferences = ref({
  essential: true, // Always true, cannot be disabled
  functional: true,
  analytics: true,
  marketing: false,
})

// Check if user has already made a choice
onMounted(() => {
  const consent = localStorage.getItem('cookie_consent')
  if (!consent) {
    // Show banner after a short delay for better UX
    setTimeout(() => {
      showBanner.value = true
    }, 1000)
  } else {
    // Load saved preferences
    const saved = JSON.parse(consent)
    cookiePreferences.value = { ...cookiePreferences.value, ...saved }
    applyCookiePreferences()
  }
})

const acceptAll = () => {
  cookiePreferences.value = {
    essential: true,
    functional: true,
    analytics: true,
    marketing: false, // We don't use marketing cookies yet
  }
  saveConsent()
  showBanner.value = false
}

const acceptEssential = () => {
  cookiePreferences.value = {
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  }
  saveConsent()
  showBanner.value = false
}

const openSettings = () => {
  showSettings.value = true
}

const savePreferences = () => {
  saveConsent()
  showSettings.value = false
  showBanner.value = false
}

const saveConsent = () => {
  localStorage.setItem('cookie_consent', JSON.stringify(cookiePreferences.value))
  localStorage.setItem('cookie_consent_date', new Date().toISOString())
  applyCookiePreferences()
}

const applyCookiePreferences = () => {
  // Apply cookie preferences
  if (!cookiePreferences.value.analytics) {
    // Disable Google Analytics
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'denied'
      })
    }
    // Disable Yandex Metrika
    if (window.ym) {
      window.ym('notBounce')
    }
  } else {
    // Enable analytics
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted'
      })
    }
  }

  // Functional cookies are controlled via localStorage
  // They don't need special handling as they're used by our app directly
}
</script>

<style scoped>
.cookie-consent-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface-0);
  border-top: 2px solid var(--primary-color);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  /* Issue #4984: Reduced z-index to not block PrimeVue dialogs (which use 1100+) */
  z-index: 1050;
  padding: 1.5rem;
  /* Issue #4984: Ensure banner doesn't block page interactions outside its bounds */
  pointer-events: auto;
}

.cookie-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.cookie-icon {
  font-size: 2rem;
  color: var(--primary-color);
}

.cookie-text {
  flex: 1;
  min-width: 300px;
}

.cookie-text h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.cookie-text p {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
  margin: 0;
}

.cookie-link {
  color: var(--primary-color);
  text-decoration: underline;
  font-weight: 500;
}

.cookie-link:hover {
  color: var(--primary-600);
}

.cookie-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cookie-settings {
  padding: 1rem 0;
}

.cookie-category {
  margin-bottom: 1rem;
}

.cookie-category h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .cookie-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .cookie-icon {
    font-size: 1.5rem;
  }

  .cookie-text {
    min-width: 100%;
  }

  .cookie-actions {
    width: 100%;
    justify-content: stretch;
  }

  .cookie-actions button {
    flex: 1;
  }
}
</style>

<template>
  <template v-if="hasError">
    <div class="error-boundary">
      <div class="error-boundary__content">
        <div class="error-boundary__icon">
          <i :class="isStaleChunk ? 'pi pi-sync' : 'pi pi-exclamation-triangle'"></i>
        </div>
        <h2 class="error-boundary__title">{{ title }}</h2>
        <p class="error-boundary__message">{{ message }}</p>

        <!-- Auto-reload countdown for stale chunk errors -->
        <div v-if="isStaleChunk && countdown > 0 && !countdownCancelled" class="error-boundary__countdown">
          <p class="error-boundary__countdown-text">
            {{ $t('errors.boundary.autoReload', { seconds: countdown }) }}
          </p>
          <div class="error-boundary__progress-bar">
            <div
              class="error-boundary__progress-fill"
              :style="{ width: ((10 - countdown) / 10 * 100) + '%' }"
            ></div>
          </div>
        </div>

        <p v-if="hint && !isStaleChunk" class="error-boundary__hint">
          <i class="pi pi-info-circle"></i> {{ hint }}
        </p>

        <div class="error-boundary__actions">
          <!-- During countdown: only cancel button -->
          <template v-if="isStaleChunk && countdown > 0 && !countdownCancelled">
            <Button
              :label="$t('errors.actions.cancelReload')"
              icon="pi pi-times"
              @click="cancelCountdown"
              class="p-button-outlined"
            />
          </template>
          <!-- After countdown exhausted or cancelled, or non-stale error -->
          <template v-else>
            <Button
              v-if="isStaleChunk"
              :label="$t('errors.actions.reloadPage')"
              icon="pi pi-refresh"
              @click="reloadPage"
              class="p-button-outlined"
            />
            <Button
              v-else
              :label="$t('errors.actions.retry')"
              icon="pi pi-refresh"
              @click="handleRetry"
              class="p-button-outlined"
            />
            <Button
              v-if="showGoHome"
              :label="$t('errors.actions.goHome')"
              icon="pi pi-home"
              @click="goHome"
              class="p-button-outlined"
            />
          </template>
        </div>
        <details v-if="showDetails && errorDetails" class="error-boundary__details">
          <summary>{{ $t('errors.technical') }}</summary>
          <pre>{{ errorDetails }}</pre>
        </details>
      </div>
    </div>
  </template>
  <template v-else>
    <slot />
  </template>
</template>

<script setup>
import { ref, onErrorCaptured, computed, inject, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { isStaleChunkError } from '@/utils/dynamicImport'

const RETRY_KEY = '__error_boundary_retries'
const MAX_AUTO_RETRIES = 2
const COUNTDOWN_SECONDS = 10

const props = defineProps({
  fallback: {
    type: [Object, Function],
    default: null
  },
  onError: {
    type: Function,
    default: null
  },
  showDetails: {
    type: Boolean,
    default: false
  },
  showGoHome: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['error'])

// Safe router access using inject with fallback
const router = inject('router', null)

// Use vue-i18n composable (works with vue-i18n v9+)
const { t } = useI18n()

const hasError = ref(false)
const error = ref(null)
const errorInfo = ref(null)
const isStaleChunk = ref(false)
const countdown = ref(0)
const countdownCancelled = ref(false)
let countdownTimer = null

const title = computed(() => {
  if (isStaleChunk.value) {
    return t('errors.boundary.staleChunkTitle') || 'Приложение обновилось'
  }
  return t('errors.boundary.title') || 'Произошла ошибка'
})

const message = computed(() => {
  if (isStaleChunk.value) {
    return t('errors.boundary.staleChunkMessage') || 'Загружена новая версия приложения.'
  }
  if (error.value?.message) {
    return error.value.message
  }
  return t('errors.boundary.message')
})

const hint = computed(() => {
  const msg = error.value?.message || ''
  if (msg.includes('nodeType') || msg.includes('is undefined') || msg.includes('is null')) {
    return t('errors.boundary.hints.nodeType')
  }
  return t('errors.boundary.hints.default')
})

const errorDetails = computed(() => {
  if (!error.value) return null
  return JSON.stringify({
    message: error.value.message,
    stack: error.value.stack,
    info: errorInfo.value,
    isStaleChunk: isStaleChunk.value
  }, null, 2)
})

function getRetryCount() {
  return Number(sessionStorage.getItem(RETRY_KEY) || 0)
}

function incrementRetryCount() {
  sessionStorage.setItem(RETRY_KEY, String(getRetryCount() + 1))
}

function startCountdown() {
  const retries = getRetryCount()
  if (retries >= MAX_AUTO_RETRIES) {
    // Exhausted auto-retries — show static buttons
    return
  }

  countdown.value = COUNTDOWN_SECONDS
  countdownCancelled.value = false

  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
      incrementRetryCount()
      window.location.reload()
    }
  }, 1000)
}

function cancelCountdown() {
  countdownCancelled.value = true
  countdown.value = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function reloadPage() {
  window.location.reload()
}

function detectStaleChunk(err) {
  if (err?.isStaleChunk) return true
  if (err?.isModuleLoadError && isStaleChunkError(err?.originalError || err)) return true
  return isStaleChunkError(err)
}

onErrorCaptured((err, instance, info) => {
  // Ignore Vue DevTools instrumentation errors — they are not real app errors
  if (err?.message?.includes('__vrv_devtools') || err?.message?.includes('__VUE_DEVTOOLS')) {
    console.warn('[ErrorBoundary] Ignored DevTools error:', err.message)
    return false
  }

  // Ignore Pinia initialization errors — AppTopbar handles them gracefully with try/catch
  if (err?.message?.includes('getActivePinia')) {
    console.warn('[ErrorBoundary] Ignored Pinia init error (handled by AppTopbar):', err.message)
    return false
  }

  hasError.value = true
  error.value = err
  errorInfo.value = info

  const stale = detectStaleChunk(err)
  isStaleChunk.value = stale

  console.error('[ErrorBoundary] Caught error:', err, info, stale ? '(stale chunk)' : '')

  if (stale) {
    startCountdown()
  }

  if (props.onError) {
    props.onError(err, instance, info)
  }

  emit('error', { error: err, instance, info })

  // Prevent error from propagating
  return false
})

const handleRetry = () => {
  hasError.value = false
  error.value = null
  errorInfo.value = null
  isStaleChunk.value = false
  cancelCountdown()
}

const goHome = () => {
  if (router) {
    router.push('/')
  } else {
    window.location.href = '/'
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
}

.error-boundary__content {
  text-align: center;
  max-width: 600px;
}

.error-boundary__icon {
  font-size: 4rem;
  color: var(--red-500);
  margin-bottom: 1rem;
}

.error-boundary__icon .pi-sync {
  color: var(--primary-color);
}

.error-boundary__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--surface-900);
}

.error-boundary__message {
  color: var(--surface-600);
  margin-bottom: 0.75rem;
}

.error-boundary__hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: center;
  font-size: 0.875rem;
  color: var(--primary-color);
  margin-bottom: 1.5rem;
}

.error-boundary__countdown {
  margin: 1rem 0 1.5rem;
}

.error-boundary__countdown-text {
  font-size: 0.9rem;
  color: var(--primary-color);
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.error-boundary__progress-bar {
  width: 100%;
  height: 6px;
  background: var(--surface-200);
  border-radius: 3px;
  overflow: hidden;
}

.error-boundary__progress-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 3px;
  transition: width 1s linear;
}

.error-boundary__actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.error-boundary__details {
  margin-top: 2rem;
  text-align: left;
}

.error-boundary__details summary {
  cursor: pointer;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.error-boundary__details pre {
  background: var(--surface-100);
  padding: 1rem;
  border-radius: 6px;
  overflow: auto;
  font-size: 0.875rem;
  max-height: 300px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-boundary__title {
    color: var(--surface-0);
  }

  .error-boundary__details pre {
    background: var(--surface-800);
  }
}
</style>

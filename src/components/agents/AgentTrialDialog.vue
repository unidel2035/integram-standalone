<template>
  <Dialog
    v-model:visible="isVisible"
    :header="getDialogTitle()"
    :style="{ width: '550px' }"
    :modal="true"
    @update:visible="handleClose"
  >
    <div v-if="agent" class="trial-dialog-content">
      <!-- Agent Info -->
      <div class="agent-info">
        <div class="agent-header">
          <span class="agent-icon">{{ agent.icon || '🤖' }}</span>
          <div class="agent-details">
            <h3 class="agent-name">{{ agent.name }}</h3>
            <p class="agent-creator">by {{ agent.creator }}</p>
          </div>
        </div>
        <p class="agent-description">{{ agent.description }}</p>
      </div>

      <!-- Trial Mode Card -->
      <div v-if="mode === 'trial'" class="access-mode-card trial-card">
        <div class="mode-header">
          <i class="pi pi-gift mode-icon" />
          <h4 class="mode-title">7-дневный пробный период</h4>
        </div>

        <div class="mode-features">
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>Полный доступ ко всем функциям</span>
          </div>
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>Без ограничений на использование</span>
          </div>
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>Автоматическое напоминание перед окончанием</span>
          </div>
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>Отмена в любой момент</span>
          </div>
        </div>

        <div class="trial-info-box">
          <i class="pi pi-info-circle" />
          <div class="info-text">
            <strong>Бесплатный доступ на 7 дней.</strong>
            После окончания пробного периода потребуется покупка или подписка.
            Вы получите уведомление за 1 день до окончания trial.
          </div>
        </div>
      </div>

      <!-- Demo Mode Card -->
      <div v-if="mode === 'demo'" class="access-mode-card demo-card">
        <div class="mode-header">
          <i class="pi pi-eye mode-icon" />
          <h4 class="mode-title">Демо-режим</h4>
        </div>

        <div class="mode-features">
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>10 запросов в день</span>
          </div>
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>Базовые функции агента</span>
          </div>
          <div class="feature-item">
            <i class="pi pi-check-circle" />
            <span>Без временных ограничений</span>
          </div>
          <div class="feature-item warning">
            <i class="pi pi-exclamation-triangle" />
            <span>Результаты с watermark "DEMO"</span>
          </div>
        </div>

        <div class="demo-info-box">
          <i class="pi pi-info-circle" />
          <div class="info-text">
            <strong>Ограниченный демо-доступ.</strong>
            Вы можете использовать агента с ограничением 10 запросов в день.
            Для полного доступа активируйте trial или приобретите агента.
          </div>
        </div>
      </div>

      <!-- Video Demo Placeholder -->
      <div v-if="hasVideoDemo" class="video-demo-section">
        <h4 class="section-title">
          <i class="pi pi-video" />
          Видео-демонстрация
        </h4>
        <div class="video-placeholder" @click="openVideoDemo">
          <div class="play-button">
            <i class="pi pi-play" />
          </div>
          <div class="video-info">
            <p class="video-title">Как работает {{ agent.name }}</p>
            <p class="video-duration">30 сек</p>
          </div>
        </div>
      </div>

      <!-- Screenshots Placeholder -->
      <div v-if="hasScreenshots" class="screenshots-section">
        <h4 class="section-title">
          <i class="pi pi-images" />
          Примеры работы
        </h4>
        <div class="screenshots-grid">
          <div v-for="i in 3" :key="i" class="screenshot-item">
            <div class="screenshot-placeholder">
              <i class="pi pi-image" />
              <span>Скриншот {{ i }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Error/Success Messages -->
      <Message v-if="errorMessage" severity="error" :closable="false">
        {{ errorMessage }}
      </Message>
      <Message v-if="successMessage" severity="success" :closable="false">
        {{ successMessage }}
      </Message>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          :label="'Отмена'"
          icon="pi pi-times"
          @click="handleClose"
          class="p-button-text"
          :disabled="processing"
        />

        <div class="footer-actions">
          <!-- Show "Watch Demo" button -->
          <Button
            v-if="hasVideoDemo"
            label="Смотреть демо"
            icon="pi pi-video"
            @click="openVideoDemo"
            class="p-button-outlined p-button-secondary"
            :disabled="processing"
          />

          <!-- Activate Trial/Demo Button -->
          <Button
            v-if="mode === 'trial'"
            label="🎁 Начать trial (7 дней)"
            icon="pi pi-check"
            @click="handleActivateTrial"
            class="p-button-success"
            :loading="processing"
          />
          <Button
            v-else-if="mode === 'demo'"
            label="Активировать демо"
            icon="pi pi-eye"
            @click="handleActivateDemo"
            class="p-button-primary"
            :loading="processing"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAgentTrialStore } from '@/stores/agentTrialStore'

const toast = useToast()

// Lazy initialization of store to avoid "no active Pinia" error
// Store will be initialized on first access via getterconst trialStore = useAgentTrialStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  agent: {
    type: Object,
    default: null
  },
  mode: {
    type: String,
    default: 'trial', // 'trial' or 'demo'
    validator: (value) => ['trial', 'demo'].includes(value)
  }
})

const emit = defineEmits(['update:modelValue', 'trial-activated', 'demo-activated'])

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const processing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Placeholder flags for video and screenshots
// In real implementation, these would come from agent metadata
const hasVideoDemo = computed(() => {
  return props.agent?.hasVideo || false
})

const hasScreenshots = computed(() => {
  return props.agent?.screenshots?.length > 0 || false
})

const getDialogTitle = () => {
  if (props.mode === 'trial') {
    return '🎁 Пробный период на 7 дней'
  }
  return '👁️ Демо-режим агента'
}

const handleClose = () => {
  if (!processing.value) {
    isVisible.value = false
    resetState()
  }
}

const resetState = () => {
  errorMessage.value = ''
  successMessage.value = ''
  processing.value = false
}

const handleActivateTrial = async () => {
  if (!props.agent) return

  processing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Activate trial in store
    const trial = trialStore.activateTrial(props.agent.id, props.agent.name)

    successMessage.value = `Trial активирован! Полный доступ на ${trialStore.TRIAL_DURATION_DAYS} дней.`

    toast.add({
      severity: 'success',
      summary: 'Trial активирован',
      detail: `У вас есть ${trialStore.TRIAL_DURATION_DAYS} дней бесплатного доступа к агенту "${props.agent.name}"`,
      life: 5000
    })

    setTimeout(() => {
      emit('trial-activated', { agent: props.agent, trial })
      handleClose()
    }, 1500)
  } catch (error) {
    errorMessage.value = error.message || 'Не удалось активировать trial'
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: errorMessage.value,
      life: 5000
    })
  } finally {
    processing.value = false
  }
}

const handleActivateDemo = async () => {
  if (!props.agent) return

  processing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Activate demo in store
    const demo = trialStore.activateDemo(props.agent.id, props.agent.name)

    successMessage.value = `Демо-режим активирован! ${trialStore.DEMO_DAILY_LIMIT} запросов в день.`

    toast.add({
      severity: 'info',
      summary: 'Демо активирован',
      detail: `Вы можете делать ${trialStore.DEMO_DAILY_LIMIT} запросов в день к агенту "${props.agent.name}"`,
      life: 5000
    })

    setTimeout(() => {
      emit('demo-activated', { agent: props.agent, demo })
      handleClose()
    }, 1500)
  } catch (error) {
    errorMessage.value = error.message || 'Не удалось активировать demo'
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: errorMessage.value,
      life: 5000
    })
  } finally {
    processing.value = false
  }
}

const openVideoDemo = () => {
  toast.add({
    severity: 'info',
    summary: 'Видео-демонстрация',
    detail: 'Функция в разработке: здесь будет видео-демо агента',
    life: 3000
  })
}
</script>

<style scoped>
.trial-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.agent-info {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.agent-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.agent-icon {
  font-size: 3rem;
  line-height: 1;
}

.agent-details {
  flex: 1;
}

.agent-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.agent-creator {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.agent-description {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-color-secondary);
}

.access-mode-card {
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid var(--surface-border);
  background: var(--surface-card);
}

.trial-card {
  border-color: var(--green-500);
  background: linear-gradient(135deg, var(--green-50) 0%, var(--surface-card) 100%);
}

.demo-card {
  border-color: var(--blue-500);
  background: linear-gradient(135deg, var(--blue-50) 0%, var(--surface-card) 100%);
}

.mode-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.mode-icon {
  font-size: 1.75rem;
  color: var(--primary-color);
}

.trial-card .mode-icon {
  color: var(--green-600);
}

.demo-card .mode-icon {
  color: var(--blue-600);
}

.mode-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.mode-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: var(--text-color);
}

.feature-item i {
  color: var(--green-500);
  font-size: 1rem;
  flex-shrink: 0;
}

.feature-item.warning i {
  color: var(--orange-500);
}

.trial-info-box,
.demo-info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 6px;
  background: var(--surface-100);
  border-left: 4px solid var(--primary-color);
}

.trial-info-box {
  border-left-color: var(--green-500);
  background: var(--green-50);
}

.demo-info-box {
  border-left-color: var(--blue-500);
  background: var(--blue-50);
}

.trial-info-box i,
.demo-info-box i {
  font-size: 1.25rem;
  color: var(--primary-color);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.trial-info-box i {
  color: var(--green-600);
}

.demo-info-box i {
  color: var(--blue-600);
}

.info-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-color);
}

.info-text strong {
  display: block;
  margin-bottom: 0.25rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.section-title i {
  color: var(--primary-color);
}

.video-demo-section {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.video-placeholder {
  position: relative;
  height: 180px;
  background: linear-gradient(135deg, var(--surface-hover) 0%, var(--surface-300) 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
}

.video-placeholder:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.play-button {
  position: absolute;
  width: 60px;
  height: 60px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.video-placeholder:hover .play-button {
  transform: scale(1.1);
  background: var(--primary-color);
}

.play-button i {
  font-size: 1.5rem;
  color: var(--primary-color);
  margin-left: 4px;
}

.video-placeholder:hover .play-button i {
  color: white;
}

.video-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  color: white;
}

.video-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.video-duration {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.9;
}

.screenshots-section {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.screenshot-item {
  aspect-ratio: 4/3;
}

.screenshot-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface-hover);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.screenshot-placeholder:hover {
  background: var(--surface-300);
  transform: scale(1.05);
}

.screenshot-placeholder i {
  font-size: 1.5rem;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}
</style>

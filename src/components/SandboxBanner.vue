<template>
  <div v-if="sandboxStore.isSandboxMode" class="sandbox-banner">
    <div class="sandbox-banner-content">
      <div class="sandbox-banner-left">
        <i class="pi pi-graduation-cap sandbox-icon"></i>
        <div class="sandbox-text">
          <span class="sandbox-title">ДЕМО-РЕЖИМ</span>
          <span class="sandbox-desc">Вы работаете с учебными данными. Изменения не сохраняются.</span>
        </div>
      </div>
      <div class="sandbox-banner-actions">
        <Button
          v-if="showScenarios"
          label="Сценарии практики"
          icon="pi pi-book"
          size="small"
          severity="warning"
          outlined
          @click="$emit('open-scenarios')"
        />
        <Button
          label="Сбросить демо"
          icon="pi pi-refresh"
          size="small"
          severity="warning"
          outlined
          @click="confirmReset"
        />
        <Button
          label="Выйти из демо"
          icon="pi pi-times"
          size="small"
          severity="warning"
          @click="sandboxStore.disableSandbox"
        />
      </div>
    </div>

    <!-- Reset Confirmation Dialog -->
    <Dialog
      v-model:visible="sandboxStore.showResetConfirmation"
      modal
      header="Сбросить демо-данные?"
      :style="{ width: '450px' }"
    >
      <div class="reset-dialog-content">
        <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: var(--p-orange-500)"></i>
        <p>Все изменения в демо-режиме будут сброшены к начальному состоянию.</p>
        <p style="margin-top: 0.5rem; color: var(--p-text-muted-color)">
          Прогресс по сценариям также будет очищен.
        </p>
      </div>
      <template #footer>
        <Button
          label="Отмена"
          severity="secondary"
          outlined
          @click="sandboxStore.showResetConfirmation = false"
        />
        <Button
          label="Сбросить"
          severity="warning"
          @click="handleReset"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { useSandboxStore } from '@/stores/sandboxStore'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

defineProps({
  showScenarios: {
    type: Boolean,
    default: true
  }
})

defineEmits(['open-scenarios'])

const sandboxStore = useSandboxStore()

function confirmReset() {
  sandboxStore.showResetConfirmation = true
}

function handleReset() {
  sandboxStore.resetDemoData()
}
</script>

<style scoped>
.sandbox-banner {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-bottom: 3px solid #d97706;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    border-bottom-color: #d97706;
  }
  50% {
    border-bottom-color: #f59e0b;
  }
}

.sandbox-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
}

.sandbox-banner-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sandbox-icon {
  font-size: 1.75rem;
  color: #78350f;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.sandbox-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.sandbox-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #78350f;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.sandbox-desc {
  font-size: 0.85rem;
  color: #92400e;
}

.sandbox-banner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Global sandbox border effect */
:global(body.sandbox-mode) {
  box-shadow: inset 0 0 0 4px #fbbf24;
}

:global(body.sandbox-mode)::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  border: 4px solid #fbbf24;
  z-index: 999999;
  animation: border-pulse 2s ease-in-out infinite;
}

@keyframes border-pulse {
  0%, 100% {
    border-color: #fbbf24;
  }
  50% {
    border-color: #f59e0b;
  }
}

.reset-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 1rem 0;
}

.reset-dialog-content p {
  margin: 0;
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 768px) {
  .sandbox-banner-content {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .sandbox-banner-actions {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .sandbox-desc {
    display: none;
  }
}
</style>

<template>
  <Dialog
    v-model:visible="isVisible"
    :modal="true"
    :closable="false"
    :dismissableMask="false"
    :style="{ width: '90vw', maxWidth: '1100px' }"
    :pt="{
      root: { class: 'role-selection-dialog' },
      header: { class: 'role-selection-header' }
    }"
  >
    <template #header>
      <div class="header-content">
        <div class="header-icon">🎓</div>
        <div>
          <h2>Добро пожаловать в VentureOS!</h2>
          <p class="subtitle">Выберите свою роль для персонализированного обучения</p>
        </div>
      </div>
    </template>

    <div class="role-cards-grid">
      <div
        v-for="role in roles"
        :key="role.id"
        class="role-card"
        :class="{ selected: selectedRole === role.id }"
        @click="selectRole(role.id)"
      >
        <div class="role-icon">{{ role.icon }}</div>
        <h3 class="role-title">{{ role.title }}</h3>
        <p class="role-subtitle">{{ role.subtitle }}</p>
        <p class="role-description">{{ role.description }}</p>

        <div class="role-path-preview">
          <div class="preview-header">
            <i class="pi pi-map"></i>
            <span>Ваш путь обучения:</span>
          </div>
          <div class="preview-steps">
            <div
              v-for="(step, idx) in getLearningPath(role.id).steps.slice(0, 3)"
              :key="step.id"
              class="preview-step"
            >
              <span class="step-number">{{ idx + 1 }}</span>
              <span class="step-title">{{ step.title }}</span>
            </div>
            <div v-if="getLearningPath(role.id).steps.length > 3" class="preview-more">
              +{{ getLearningPath(role.id).steps.length - 3 }} ещё
            </div>
          </div>
        </div>

        <div v-if="selectedRole === role.id" class="selected-indicator">
          <i class="pi pi-check-circle"></i>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-content">
        <Button
          label="Выбрать позже"
          icon="pi pi-times"
          text
          @click="skipSelection"
        />
        <Button
          label="Начать обучение"
          icon="pi pi-arrow-right"
          :disabled="!selectedRole"
          @click="confirmSelection"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { ROLE_METADATA, LEARNING_PATHS, setUserRole, isRoleSelected } from '@/config/learningPaths'
import { useRouter } from 'vue-router'

const router = useRouter()
const emit = defineEmits(['role-selected', 'skipped'])

const isVisible = ref(!isRoleSelected())
const selectedRole = ref(null)

const roles = computed(() => Object.values(ROLE_METADATA))

function getLearningPath(roleId) {
  return LEARNING_PATHS[roleId] || { steps: [] }
}

function selectRole(roleId) {
  selectedRole.value = roleId
}

function confirmSelection() {
  if (selectedRole.value) {
    setUserRole(selectedRole.value)
    isVisible.value = false
    emit('role-selected', selectedRole.value)

    // Перенаправить на первый шаг пути обучения выбранной роли
    const path = LEARNING_PATHS[selectedRole.value]
    const firstRoute = path?.steps?.[0]?.route || '/fst-hub'
    router.push(firstRoute)
  }
}

function skipSelection() {
  localStorage.setItem('ventureOS_roleSkipped', 'true')
  localStorage.setItem('ventureOS_roleSelected', 'true')  // fix: isRoleSelected() checks this key
  isVisible.value = false
  emit('skipped')
}

// Expose method to show modal programmatically
defineExpose({
  show: () => {
    isVisible.value = true
  }
})
</script>

<style scoped>
.role-selection-dialog :deep(.p-dialog-header) {
  background: linear-gradient(135deg, var(--p-primary-500) 0%, var(--p-primary-700) 100%);
  color: white;
  padding: 2rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.header-icon {
  font-size: 3rem;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.header-content h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.subtitle {
  margin: 0.5rem 0 0 0;
  font-size: 1rem;
  opacity: 0.95;
}

.role-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem 0;
}

.role-card {
  position: relative;
  background: var(--surface-card);
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.role-card:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px var(--p-surface-shadow, rgba(0, 0, 0, 0.12));
}

.role-card.selected {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--surface-card));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-color) 20%, transparent);
}

.role-icon {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 0.5rem;
}

.role-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
  color: var(--p-text-color);
}

.role-subtitle {
  font-size: 0.875rem;
  color: var(--p-text-secondary-color);
  text-align: center;
  margin: 0;
  font-weight: 500;
}

.role-description {
  font-size: 0.9rem;
  color: var(--p-text-color);
  line-height: 1.5;
  margin: 0;
  text-align: center;
  flex-grow: 1;
}

.role-path-preview {
  background: var(--p-surface-card);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 0.75rem;
}

.preview-header i {
  color: var(--p-primary-color);
}

.preview-steps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--p-primary-color);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.step-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-more {
  font-size: 0.8rem;
  color: var(--p-text-secondary-color);
  font-style: italic;
  text-align: center;
  margin-top: 0.25rem;
}

.selected-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: var(--p-primary-color);
  font-size: 1.5rem;
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 1rem;
}

@media (max-width: 768px) {
  .role-cards-grid {
    grid-template-columns: 1fr;
  }

  .header-content h2 {
    font-size: 1.25rem;
  }

  .header-icon {
    font-size: 2rem;
  }
}
</style>

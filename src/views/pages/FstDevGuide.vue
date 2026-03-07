<template>
  <div class="fst-dev-guide-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <i class="pi pi-book" style="font-size: 2rem; color: var(--p-primary-color);"></i>
          <div>
            <h1>🎓 Путь обучения VentureOS</h1>
            <p class="subtitle">Персонализированное обучение в зависимости от вашей роли</p>
          </div>
        </div>
        <div class="header-actions">
          <Button
            v-if="currentRole"
            label="Сменить роль"
            icon="pi pi-refresh"
            outlined
            @click="showRoleModal = true"
          />
          <Button
            v-if="currentRole"
            label="Сбросить прогресс"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="confirmResetProgress"
          />
        </div>
      </div>
    </div>

    <!-- No Role Selected -->
    <Card v-if="!currentRole" class="no-role-card">
      <template #content>
        <div class="no-role-content">
          <div class="no-role-icon">🎯</div>
          <h2>Выберите свою роль</h2>
          <p>Чтобы начать персонализированное обучение, выберите роль, которая соответствует вашим задачам.</p>
          <Button
            label="Выбрать роль"
            icon="pi pi-user"
            size="large"
            @click="showRoleModal = true"
          />
        </div>
      </template>
    </Card>

    <!-- Learning Progress Component -->
    <LearningProgress
      v-else
      @change-role="showRoleModal = true"
    />

    <!-- Role Selection Modal -->
    <RoleSelectionModal
      ref="roleModalRef"
      @role-selected="handleRoleSelected"
      @skipped="handleSkipped"
    />

    <!-- Quick Links -->
    <Card v-if="currentRole" class="quick-links-card">
      <template #title>
        <div class="card-title">
          <i class="pi pi-link"></i>
          <span>Полезные ресурсы</span>
        </div>
      </template>
      <template #content>
        <div class="quick-links-grid">
          <div
            v-for="link in quickLinks"
            :key="link.route"
            class="quick-link"
            @click="$router.push(link.route)"
          >
            <i :class="link.icon"></i>
            <span>{{ link.title }}</span>
          </div>
        </div>
      </template>
    </Card>

    <!-- All Roles Overview -->
    <Card v-if="currentRole" class="roles-overview-card">
      <template #title>
        <div class="card-title">
          <i class="pi pi-users"></i>
          <span>Другие роли</span>
        </div>
      </template>
      <template #content>
        <div class="roles-overview-grid">
          <div
            v-for="role in otherRoles"
            :key="role.id"
            class="role-overview-item"
          >
            <div class="role-overview-header">
              <span class="role-icon">{{ role.icon }}</span>
              <div>
                <h4>{{ role.title }}</h4>
                <p class="role-subtitle">{{ role.subtitle }}</p>
              </div>
            </div>
            <p class="role-desc">{{ role.description }}</p>
            <Button
              label="Посмотреть путь"
              icon="pi pi-eye"
              text
              size="small"
              @click="previewRole(role.id)"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Preview Dialog -->
    <Dialog
      v-model:visible="showPreviewDialog"
      :header="previewRoleData?.title"
      :modal="true"
      :style="{ width: '700px' }"
    >
      <div v-if="previewRoleData" class="preview-content">
        <div class="preview-header">
          <span class="preview-icon">{{ previewRoleData.icon }}</span>
          <div>
            <h3>{{ previewRoleData.title }}</h3>
            <p>{{ previewRoleData.description }}</p>
          </div>
        </div>
        <Divider />
        <h4>Путь обучения ({{ previewPath?.steps.length || 0 }} шагов):</h4>
        <div class="preview-steps-list">
          <div
            v-for="(step, idx) in previewPath?.steps || []"
            :key="step.id"
            class="preview-step-item"
          >
            <span class="preview-step-number">{{ idx + 1 }}</span>
            <div class="preview-step-info">
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
              <small>⏱️ {{ step.estimatedTime }}</small>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          label="Переключиться на эту роль"
          icon="pi pi-refresh"
          @click="switchToPreviewRole"
        />
        <Button
          label="Закрыть"
          icon="pi pi-times"
          text
          @click="showPreviewDialog = false"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import LearningProgress from '@/components/LearningProgress.vue'
import RoleSelectionModal from '@/components/RoleSelectionModal.vue'
import {
  getUserRole,
  setUserRole,
  ROLE_METADATA,
  LEARNING_PATHS,
  resetUserProgress
} from '@/config/learningPaths'

const router = useRouter()
const toast = useToast()

const currentRole = ref(getUserRole())
const showRoleModal = ref(false)
const showPreviewDialog = ref(false)
const previewRoleId = ref(null)
const roleModalRef = ref(null)

const quickLinks = computed(() => [
  { title: 'Глоссарий терминов', route: '/fst-glossary', icon: 'pi pi-book' },
  { title: 'Обзор платформы', route: '/fst-hub', icon: 'pi pi-home' },
  { title: 'Все модули', route: '/fst-hub', icon: 'pi pi-th-large' },
  { title: 'Справка', route: '/fst-hub', icon: 'pi pi-question-circle' },
])

const otherRoles = computed(() => {
  return Object.values(ROLE_METADATA).filter(role => role.id !== currentRole.value)
})

const previewRoleData = computed(() => {
  return previewRoleId.value ? ROLE_METADATA[previewRoleId.value] : null
})

const previewPath = computed(() => {
  return previewRoleId.value ? LEARNING_PATHS[previewRoleId.value] : null
})

function handleRoleSelected(roleId) {
  currentRole.value = roleId
  toast.add({
    severity: 'success',
    summary: 'Роль выбрана',
    detail: `Ваш путь обучения: ${ROLE_METADATA[roleId]?.title}`,
    life: 3000,
  })
}

function handleSkipped() {
  toast.add({
    severity: 'info',
    summary: 'Выбор отложен',
    detail: 'Вы можете выбрать роль позже на этой странице',
    life: 3000,
  })
}

function confirmResetProgress() {
  if (confirm('Вы уверены? Весь прогресс обучения будет удалён.')) {
    resetUserProgress()
    currentRole.value = null
    toast.add({
      severity: 'warn',
      summary: 'Прогресс сброшен',
      detail: 'Вы можете начать обучение заново',
      life: 3000,
    })
  }
}

function previewRole(roleId) {
  previewRoleId.value = roleId
  showPreviewDialog.value = true
}

function switchToPreviewRole() {
  if (previewRoleId.value) {
    setUserRole(previewRoleId.value)
    currentRole.value = previewRoleId.value
    showPreviewDialog.value = false
    toast.add({
      severity: 'success',
      summary: 'Роль изменена',
      detail: `Теперь ваш путь: ${ROLE_METADATA[previewRoleId.value]?.title}`,
      life: 3000,
    })
  }
}

onMounted(() => {
  // If no role selected, show modal
  if (!currentRole.value) {
    setTimeout(() => {
      showRoleModal.value = true
    }, 500)
  }
})
</script>

<style scoped>
.fst-dev-guide-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-section h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}

.subtitle {
  margin: 0.25rem 0 0 0;
  color: var(--p-text-secondary-color);
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.no-role-card {
  margin-bottom: 2rem;
}

.no-role-content {
  text-align: center;
  padding: 3rem 2rem;
}

.no-role-icon {
  font-size: 5rem;
  margin-bottom: 1.5rem;
}

.no-role-content h2 {
  margin: 0 0 1rem 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.no-role-content p {
  margin: 0 0 2rem 0;
  color: var(--p-text-secondary-color);
  font-size: 1.1rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.quick-links-card,
.roles-overview-card {
  margin-top: 2rem;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.quick-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--p-surface-ground);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.quick-link:hover {
  background: var(--p-primary-50);
  border-color: var(--p-primary-color);
  transform: translateY(-2px);
}

.quick-link i {
  font-size: 1.5rem;
  color: var(--p-primary-color);
}

.quick-link span {
  font-weight: 500;
}

.roles-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.role-overview-item {
  background: var(--p-surface-ground);
  border-radius: 12px;
  padding: 1.5rem;
  border: 2px solid var(--p-surface-border);
  transition: all 0.3s ease;
}

.role-overview-item:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-2px);
}

.role-overview-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.role-overview-header .role-icon {
  font-size: 2.5rem;
}

.role-overview-header h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.role-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
}

.role-desc {
  margin: 0 0 1rem 0;
  color: var(--p-text-secondary-color);
  line-height: 1.5;
  font-size: 0.95rem;
}

.preview-content {
  padding: 1rem 0;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.preview-icon {
  font-size: 3rem;
}

.preview-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.preview-header p {
  margin: 0;
  color: var(--p-text-secondary-color);
  line-height: 1.5;
}

.preview-steps-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.preview-step-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--p-surface-ground);
  border-radius: 8px;
}

.preview-step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--p-primary-color);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  flex-shrink: 0;
}

.preview-step-info {
  flex: 1;
}

.preview-step-info strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 1rem;
}

.preview-step-info p {
  margin: 0.25rem 0;
  color: var(--p-text-secondary-color);
  font-size: 0.9rem;
}

.preview-step-info small {
  color: var(--p-text-secondary-color);
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .quick-links-grid {
    grid-template-columns: 1fr;
  }

  .roles-overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>

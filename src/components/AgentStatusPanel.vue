<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getOrchestratorStatus } from '@/services/orchestratorService'
import { logger } from '@/utils/logger'

const router = useRouter()
const { t } = useI18n()

const emit = defineEmits(['update:visible', 'close'])

// ==================== ORCHESTRATOR STATE (Issue #5632) ====================
// Replaced workspaceAgentStore with unified orchestrator status
// This now shows ALL agents: production, workspace, custom, genesis, etc.

const orchestratorStatus = ref(null)
const loading = ref(false)
const error = ref(null)
const lastRefresh = ref(null)

// Auto-refresh interval (2 minutes to avoid 429 rate limiting)
let refreshInterval = null

const loadAgentStatus = async () => {
  try {
    loading.value = true
    error.value = null

    const result = await getOrchestratorStatus()

    if (result.success) {
      // Add fallback defaults for undefined values (Issue #6361)
      const statusData = result.data?.status || {}
      orchestratorStatus.value = {
        orchestrator: {
          initialized: statusData.orchestrator?.initialized ?? false,
          status: statusData.orchestrator?.status || 'unknown',
          lastSyncTime: statusData.orchestrator?.lastSyncTime || null,
          syncCount: statusData.orchestrator?.syncCount || 0
        },
        registry: {
          totalAgents: statusData.registry?.totalAgents ?? 0,
          byType: statusData.registry?.byType || {},
          byStatus: statusData.registry?.byStatus || {},
          autoSyncEnabled: statusData.registry?.autoSyncEnabled ?? false,
          loadFromDatabase: statusData.registry?.loadFromDatabase ?? false
        },
        agents: statusData.agents || []
      }
      lastRefresh.value = new Date()
      logger.debug('[AgentStatusPanel] Loaded orchestrator status:', {
        totalAgents: orchestratorStatus.value.registry.totalAgents,
        initialized: orchestratorStatus.value.orchestrator.initialized
      })
    } else {
      error.value = result.error || 'Failed to load agent status'
      logger.warn('[AgentStatusPanel] Failed to load status:', error.value)
    }
  } catch (err) {
    error.value = err.message
    logger.error('[AgentStatusPanel] Error loading status:', err)
  } finally {
    loading.value = false
  }
}

// Computed properties for template
const allAgents = computed(() => orchestratorStatus.value?.agents || [])
const hasAgents = computed(() => allAgents.value.length > 0)
const totalAgents = computed(() => orchestratorStatus.value?.registry?.totalAgents || 0)
const agentsByType = computed(() => orchestratorStatus.value?.registry?.byType || {})
const isInitialized = computed(() => orchestratorStatus.value?.orchestrator?.initialized || false)

// Lifecycle hooks
onMounted(() => {
  loadAgentStatus()
  // Start auto-refresh (2 minutes to avoid 429 rate limiting)
  refreshInterval = setInterval(loadAgentStatus, 120000) // Refresh every 2 minutes
})

// Get props for watch
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

// Watch for panel visibility - refresh when opened
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    loadAgentStatus()
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

// Agent type helpers
const getTypeIcon = (type) => {
  const icons = {
    'PRODUCTION': 'pi-briefcase',
    'GOAL_ORIENTED': 'pi-compass',
    'CUSTOM': 'pi-cog',
    'GENESIS': 'pi-star',
    'TEMPLATE': 'pi-file-edit',
    'WORKSPACE': 'pi-folder'
  }
  return icons[type] || 'pi-robot'
}

const getTypeColor = (type) => {
  const colors = {
    'PRODUCTION': 'text-blue-600',
    'GOAL_ORIENTED': 'text-purple-600',
    'CUSTOM': 'text-green-600',
    'GENESIS': 'text-yellow-600',
    'TEMPLATE': 'text-cyan-600',
    'WORKSPACE': 'text-orange-600'
  }
  return colors[type] || 'text-gray-600'
}

const getTypeLabel = (type) => {
  const labels = {
    'PRODUCTION': t('agents.types.production', 'Production'),
    'GOAL_ORIENTED': t('agents.types.goalOriented', 'Goal-Oriented'),
    'CUSTOM': t('agents.types.custom', 'Custom'),
    'GENESIS': t('agents.types.genesis', 'Genesis'),
    'TEMPLATE': t('agents.types.template', 'Template'),
    'WORKSPACE': t('agents.types.workspace', 'Workspace')
  }
  return labels[type] || type
}

// Agent status helpers
const getStatusIcon = (status) => {
  const icons = {
    'active': 'pi-check-circle',
    'inactive': 'pi-pause-circle',
    'error': 'pi-exclamation-triangle',
    'running': 'pi-cog pi-spin',
    'stopped': 'pi-stop-circle'
  }
  return icons[status] || 'pi-circle'
}

const getStatusColor = (status) => {
  const colors = {
    'active': 'text-green-500',
    'inactive': 'text-gray-500',
    'error': 'text-red-500',
    'running': 'text-blue-500',
    'stopped': 'text-gray-400'
  }
  return colors[status] || 'text-gray-500'
}

const getStatusLabel = (status) => {
  const labels = {
    'active': t('agents.status.active', 'Активен'),
    'inactive': t('agents.status.inactive', 'Неактивен'),
    'error': t('agents.status.error', 'Ошибка'),
    'running': t('agents.status.running', 'Работает'),
    'stopped': t('agents.status.stopped', 'Остановлен')
  }
  return labels[status] || status
}

const viewAgentDetails = (agent) => {
  logger.info('[AgentStatusPanel] View agent details:', agent.id)
  // Navigate to agent details page or open details modal
  if (agent.type === 'WORKSPACE') {
    router.push(`/workspaces`)
  } else {
    router.push(`/spaces`)
  }
  handleClose()
}

const refreshStatus = () => {
  loadAgentStatus()
}
</script>

<template>
  <Sidebar
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    position="right"
    class="agent-status-panel w-full md:w-30rem"
  >
    <template #header>
      <div class="flex justify-between items-center w-full">
        <div class="flex items-center gap-2">
          <i class="pi pi-sitemap text-xl"></i>
          <span class="font-semibold text-lg">{{ t('agents.title', 'Агенты') }}</span>
          <Badge
            v-if="totalAgents > 0"
            :value="totalAgents"
            severity="success"
            class="ml-2"
          />
        </div>
        <Button
          icon="pi pi-refresh"
          text
          rounded
          size="small"
          @click="refreshStatus"
          :loading="loading"
          :title="t('agents.refresh', 'Обновить')"
        />
      </div>
    </template>

    <div class="agent-panel-content">
      <!-- Loading State -->
      <div v-if="loading && !orchestratorStatus" class="text-center py-8">
        <i class="pi pi-spin pi-spinner text-4xl text-primary mb-3"></i>
        <p class="text-surface-500">{{ t('agents.loading', 'Загрузка агентов...') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-center gap-2 mb-2">
          <i class="pi pi-exclamation-triangle text-red-600"></i>
          <span class="font-medium text-red-600">{{ t('agents.error', 'Ошибка') }}</span>
        </div>
        <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <Button
          :label="t('agents.retry', 'Повторить')"
          icon="pi pi-refresh"
          severity="danger"
          outlined
          size="small"
          class="mt-3"
          @click="loadAgentStatus"
        />
      </div>

      <!-- Summary Stats -->
      <div v-else-if="hasAgents" class="agent-summary mb-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-chart-bar text-primary"></i>
            <span class="text-sm font-medium">{{ t('agents.statistics', 'Статистика') }}</span>
          </div>
          <div class="flex gap-4 text-sm">
            <span>
              <i class="pi pi-sitemap mr-1"></i>
              {{ totalAgents }} {{ t('agents.total', 'всего') }}
            </span>
            <span v-if="isInitialized" class="text-green-600 dark:text-green-400">
              <i class="pi pi-check-circle mr-1"></i>
              {{ t('agents.initialized', 'Готов') }}
            </span>
          </div>
        </div>

        <!-- Agents by Type -->
        <div v-if="Object.keys(agentsByType).length > 0" class="flex flex-wrap gap-2">
          <Tag
            v-for="(count, type) in agentsByType"
            :key="type"
            :value="`${getTypeLabel(type)}: ${count}`"
            :severity="count > 0 ? 'success' : 'secondary'"
            class="text-xs"
          />
        </div>
      </div>

      <!-- Agent List -->
      <div v-if="hasAgents" class="agent-list flex flex-col gap-3">
        <div
          v-for="agent in allAgents"
          :key="agent.id"
          class="agent-card p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
        >
          <!-- Agent Header -->
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2 cursor-pointer" @click="viewAgentDetails(agent)">
              <i :class="['pi', getTypeIcon(agent.type), getTypeColor(agent.type)]"></i>
              <div>
                <div class="font-medium text-sm">{{ agent.name }}</div>
                <div class="text-xs text-surface-500">{{ agent.metadata?.description || getTypeLabel(agent.type) }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Tag
                :value="getTypeLabel(agent.type)"
                :severity="agent.status === 'active' ? 'success' : 'secondary'"
                class="text-xs"
              />
            </div>
          </div>

          <!-- Agent Status and Priority -->
          <div class="flex items-center gap-3 mb-2">
            <div class="flex items-center gap-1 text-xs">
              <i :class="['pi', getStatusIcon(agent.status), getStatusColor(agent.status)]"></i>
              <span>{{ getStatusLabel(agent.status) }}</span>
            </div>
            <div class="flex items-center gap-1 text-xs text-surface-500">
              <i class="pi pi-star-fill"></i>
              <span>{{ t('agents.priority', 'Приоритет') }}: {{ agent.priority }}</span>
            </div>
          </div>

          <!-- Capabilities -->
          <div v-if="agent.capabilities && agent.capabilities.length > 0" class="capabilities mb-2">
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="capability in agent.capabilities.slice(0, 5)"
                :key="capability"
                :value="capability"
                severity="info"
                class="text-xs"
              />
              <Tag
                v-if="agent.capabilities.length > 5"
                :value="`+${agent.capabilities.length - 5}`"
                severity="secondary"
                class="text-xs"
              />
            </div>
          </div>

          <!-- Agent Metadata -->
          <div class="agent-metadata flex gap-4 text-xs text-surface-500">
            <span v-if="agent.metadata?.category" :title="t('agents.category', 'Категория')">
              <i class="pi pi-tag mr-1"></i>
              {{ agent.metadata.category }}
            </span>
            <span v-if="agent.metadata?.source" :title="t('agents.source', 'Источник')">
              <i class="pi pi-database mr-1"></i>
              {{ agent.metadata.source }}
            </span>
          </div>

          <!-- Agent Actions -->
          <div class="agent-actions flex justify-between items-center pt-2 mt-2 border-t border-surface-200 dark:border-surface-700">
            <span class="text-xs text-surface-400">
              ID: {{ agent.id }}
            </span>
            <div class="flex gap-1">
              <Button
                icon="pi pi-eye"
                severity="secondary"
                text
                rounded
                size="small"
                @click="viewAgentDetails(agent)"
                :title="t('agents.viewDetails', 'Посмотреть детали')"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading" class="empty-state text-center py-8">
        <i class="pi pi-sitemap text-4xl text-surface-300 dark:text-surface-600 mb-3"></i>
        <p class="text-surface-500 mb-4">{{ t('agents.noAgents', 'Агенты не зарегистрированы') }}</p>
        <p class="text-sm text-surface-400 mb-4">
          {{ t('agents.emptyStateHint', 'Orchestrator не содержит зарегистрированных агентов. Возможно, система еще не инициализировалась.') }}
        </p>
        <div class="flex flex-col gap-2">
          <Button
            :label="t('agents.viewAllAgents', 'Посмотреть все агенты')"
            icon="pi pi-th-large"
            severity="primary"
            outlined
            @click="router.push('/spaces'); handleClose()"
          />
          <Button
            :label="t('agents.refreshStatus', 'Обновить статус')"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            @click="loadAgentStatus"
          />
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<style scoped>
.agent-status-panel {
  --sidebar-width: 28rem;
}

.agent-panel-content {
  padding: 0.5rem;
}

.agent-card {
  transition: all 0.2s ease;
}

.agent-card:hover {
  transform: translateX(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.agent-stats span {
  display: flex;
  align-items: center;
}

.empty-state i {
  display: block;
}

:deep(.p-sidebar-header) {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--surface-border);
}

:deep(.p-sidebar-content) {
  padding: 1rem;
}

/* Dark mode adjustments */
:deep(.p-sidebar) {
  background: var(--p-surface-0);
}

.dark :deep(.p-sidebar) {
  background: var(--p-surface-900);
}

.dark :deep(.p-sidebar-header) {
  border-bottom-color: var(--p-surface-700);
}
</style>

<template>
  <div class="agent-selector" :class="{ compact }">
    <!-- Selected Agent Display -->
    <div
      class="selected-agent"
      :class="{ 'has-agent': selectedAgent }"
      @click="toggleDropdown"
    >
      <div v-if="loading" class="agent-loading">
        <i class="pi pi-spin pi-spinner"></i>
      </div>
      <div v-else-if="selectedAgent" class="agent-display">
        <span class="agent-icon">{{ selectedAgent.icon || '🤖' }}</span>
        <span v-if="!compact" class="agent-name">{{ selectedAgent.name }}</span>
        <i v-if="selectedAgent.hasCustomPrompt" class="pi pi-star-fill custom-prompt-badge" title="Custom system prompt"></i>
        <i class="pi pi-chevron-down dropdown-arrow"></i>
      </div>
      <div v-else class="agent-placeholder">
        <i class="pi pi-bolt"></i>
        <span v-if="!compact">Agent</span>
        <i class="pi pi-chevron-down dropdown-arrow"></i>
      </div>
    </div>

    <!-- Dropdown Panel -->
    <Popover
      ref="overlayPanel"
      :dismissable="true"
      :showCloseIcon="false"
      class="agent-selector-panel"
    >
      <div class="panel-content">
        <!-- Header -->
        <div class="panel-header">
          <span class="panel-title">AI Agents</span>
          <span class="agent-count">{{ categoryCounts.all || 0 }}</span>
        </div>

        <!-- Search -->
        <div class="search-section">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              placeholder="Search agents..."
              class="w-full"
              size="small"
            />
          </IconField>
        </div>

        <!-- Categories (scrollable chips) -->
        <div class="categories-section">
          <div class="category-chips">
            <span
              v-for="cat in categories"
              :key="cat.value"
              class="cat-chip"
              :class="{ active: selectedCategory === cat.value }"
              @click="selectedCategory = cat.value"
            >
              <span class="cat-icon">{{ cat.icon }}</span>
              <span class="cat-label">{{ cat.label }}</span>
              <span v-if="categoryCounts[cat.value]" class="cat-count">{{ categoryCounts[cat.value] }}</span>
            </span>
          </div>
        </div>

        <!-- Recent Agents (inspired by MemGPT history pattern) -->
        <div v-if="recentAgents.length > 0 && !searchQuery && selectedCategory === 'all'" class="recent-section">
          <div class="section-label">Recent</div>
          <div class="recent-chips">
            <span
              v-for="agent in recentAgents"
              :key="'recent-' + agent.id"
              class="recent-chip"
              :class="{ active: selectedAgent?.id === agent.id }"
              @click="handleSelect(agent)"
            >
              <span class="recent-icon">{{ agent.icon }}</span>
              <span class="recent-name">{{ agent.name }}</span>
            </span>
          </div>
        </div>

        <!-- Agents List -->
        <div class="agents-list">
          <div v-if="loading" class="loading-state">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Loading agents...</span>
          </div>

          <div
            v-else
            v-for="agent in filteredAgents.slice(0, 50)"
            :key="agent.id"
            class="agent-item"
            :class="{ selected: selectedAgent?.id === agent.id }"
            @click="handleSelect(agent)"
          >
            <div class="agent-item-icon">{{ agent.icon }}</div>
            <div class="agent-item-info">
              <div class="agent-item-name">
                {{ agent.name }}
                <i v-if="agent.hasCustomPrompt" class="pi pi-star-fill custom-star" title="Has system prompt"></i>
                <span v-if="getAgentRating(agent.id)" class="agent-rating" :title="getAgentRating(agent.id).count + ' ratings'">
                  {{ getAgentRating(agent.id).average.toFixed(1) }}
                </span>
                <span v-if="getSuccessRate(agent.id)" class="agent-success" :title="'Feedback: ' + getSuccessRate(agent.id).thumbsUp + '/' + getSuccessRate(agent.id).total">
                  {{ Math.round(getSuccessRate(agent.id).rate * 100) }}%
                </span>
              </div>
              <div class="agent-item-description">{{ agent.description }}</div>
              <div v-if="agent.triggers?.length" class="agent-item-triggers">
                <span v-for="trigger in agent.triggers.slice(0, 3)" :key="trigger" class="trigger-tag">{{ trigger }}</span>
              </div>
            </div>
            <div class="agent-item-actions">
              <i
                :class="isFavorite(agent.id) ? 'pi pi-heart-fill' : 'pi pi-heart'"
                class="fav-btn"
                :title="isFavorite(agent.id) ? 'Remove from favorites' : 'Add to favorites'"
                @click.stop="toggleFavorite(agent.id)"
              ></i>
              <i v-if="selectedAgent?.id === agent.id" class="pi pi-check-circle check-icon"></i>
            </div>
          </div>

          <div v-if="!loading && filteredAgents.length === 0" class="empty-state">
            <i class="pi pi-search empty-icon"></i>
            <p>No agents found</p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <Button
            label="Clear"
            icon="pi pi-times"
            severity="secondary"
            size="small"
            text
            @click="handleClear"
            :disabled="!selectedAgent"
          />
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            size="small"
            text
            @click="handleRefresh"
          />
          <Button
            label="Agents"
            icon="pi pi-external-link"
            severity="secondary"
            size="small"
            text
            @click="manageAgents"
          />
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import { useAgentSelector } from '@/composables/useAgentSelector'
import { useAgentMarketplace } from '@/composables/useAgentMarketplace'
import { useAgentFeedback } from '@/composables/useAgentFeedback'

const props = defineProps({
  modelValue: { type: Object, default: null },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])
const router = useRouter()
const overlayPanel = ref(null)

const {
  agents,
  loading,
  selectedAgent,
  searchQuery,
  selectedCategory,
  filteredAgents,
  categories,
  categoryCounts,
  recentAgents,
  selectAgent,
  clearAgent,
  refreshAgents
} = useAgentSelector()

const { toggleFavorite, isFavorite, getAgentRating } = useAgentMarketplace()
const { getSuccessRate } = useAgentFeedback()

// Sync with v-model (parent can set agent externally)
watch(() => props.modelValue, (val) => {
  if (val && val.id !== selectedAgent.value?.id) {
    selectAgent(val)
  } else if (!val && selectedAgent.value) {
    clearAgent()
  }
}, { immediate: true })

// Emit changes to parent
watch(selectedAgent, (val) => {
  emit('update:modelValue', val)
  emit('change', val)
})

function toggleDropdown(event) {
  overlayPanel.value.toggle(event)
}

function handleSelect(agent) {
  selectAgent(agent)
  overlayPanel.value.hide()
}

function handleClear() {
  clearAgent()
  overlayPanel.value.hide()
}

function handleRefresh() {
  refreshAgents()
}

function manageAgents() {
  overlayPanel.value.hide()
  router.push('/spaces')
}
</script>

<style scoped>
.agent-selector {
  position: relative;
}

.selected-agent {
  display: flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--surface-card, #f7f7f5);
  min-width: 140px;
  gap: 0.4rem;
}

.compact .selected-agent {
  min-width: auto;
  padding: 0.3rem 0.5rem;
}

.selected-agent:hover {
  border-color: var(--p-primary-color);
  background: var(--surface-hover);
}

.selected-agent.has-agent {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 5%, var(--surface-card, #f7f7f5));
}

.agent-loading {
  color: var(--p-text-muted-color);
}

.agent-display {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 0;
}

.agent-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.agent-name {
  font-weight: 500;
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-prompt-badge {
  font-size: 0.6rem;
  color: var(--p-yellow-500);
  flex-shrink: 0;
}

.dropdown-arrow {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  margin-left: auto;
  flex-shrink: 0;
}

.agent-placeholder {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--p-text-muted-color);
  flex: 1;
  font-size: 0.8rem;
}

/* Panel */
:deep(.agent-selector-panel) {
  width: 380px;
  max-width: 90vw;
}

:deep(.agent-selector-panel .p-popover-content) {
  padding: 0;
}

.panel-content {
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0;
}

.panel-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.agent-count {
  font-size: 0.7rem;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
}

.search-section {
  padding: 0.5rem 1rem;
}

/* Categories */
.categories-section {
  padding: 0 1rem 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.category-chips {
  display: flex;
  gap: 0.3rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
}

.cat-chip {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  background: var(--p-surface-card);
  border: 1px solid transparent;
}

.cat-chip:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border);
}

.cat-chip.active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.cat-icon {
  font-size: 0.8rem;
}

.cat-count {
  font-size: 0.6rem;
  opacity: 0.7;
}

/* Recent Agents */
.recent-section {
  padding: 0.4rem 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.section-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 0.3rem;
  font-weight: 600;
}

.recent-chips {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.recent-chip {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.4rem;
  border-radius: 10px;
  font-size: 0.7rem;
  cursor: pointer;
  background: var(--p-surface-card);
  transition: all 0.15s;
  border: 1px solid transparent;
}

.recent-chip:hover {
  background: var(--surface-hover);
  border-color: var(--p-primary-color);
}

.recent-chip.active {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  border-color: var(--p-primary-color);
}

.recent-icon {
  font-size: 0.75rem;
}

.recent-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Agents List */
.agents-list {
  max-height: 320px;
  overflow-y: auto;
}

.loading-state {
  padding: 2rem;
  text-align: center;
  color: var(--p-text-muted-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.agent-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.agent-item:hover {
  background: var(--surface-hover);
}

.agent-item.selected {
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
  border-left-color: var(--p-primary-color);
}

.agent-item-icon {
  font-size: 1.3rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-card);
  border-radius: 6px;
  flex-shrink: 0;
}

.agent-item-info {
  flex: 1;
  min-width: 0;
}

.agent-item-name {
  font-weight: 500;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.custom-star {
  font-size: 0.55rem;
  color: var(--p-yellow-500);
}

.agent-item-description {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.15rem;
}

.agent-item-triggers {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.3rem;
  flex-wrap: wrap;
}

.trigger-tag {
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
}

.agent-rating {
  font-size: 0.6rem;
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  background: var(--p-yellow-100);
  color: var(--p-yellow-700);
  font-weight: 600;
}

.agent-success {
  font-size: 0.6rem;
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  background: var(--p-green-100);
  color: var(--p-green-700);
  font-weight: 600;
}

.agent-item-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.fav-btn {
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  transition: color 0.15s;
}

.fav-btn:hover,
.fav-btn.pi-heart-fill {
  color: var(--p-red-500);
}

.check-icon {
  color: var(--p-primary-color);
  font-size: 1rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--p-text-muted-color);
}

.empty-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  margin: 0;
  font-size: 0.85rem;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--surface-border);
  background: var(--p-surface-card);
  gap: 0.25rem;
}

.quick-actions :deep(.p-button) {
  font-size: 0.75rem;
}
</style>

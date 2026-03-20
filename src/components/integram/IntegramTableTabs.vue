<template>
  <div class="integram-table-tabs">
    <!-- Tab bar (always visible so + button is accessible) -->
    <div class="tabs-bar" v-if="tabs.length > 0">
      <div class="tabs-scroll-container" ref="tabsContainer">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ 'tab-active': activeTabId === tab.id }"
          @click="switchToTab(tab.id)"
          @mousedown.middle.prevent="closeTab(tab.id)"
          :title="tab.name || `Таблица ${tab.typeId}`"
        >
          <i :class="getTabIcon(tab.viewType)" class="tab-icon"></i>
          <span class="tab-label">{{ tab.name || `Таблица ${tab.typeId}` }}</span>
          <button
            class="tab-close-btn"
            @click.stop="closeTab(tab.id)"
            :title="'Закрыть'"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
      <!-- Add tab button -->
      <button
        class="tab-add-btn"
        @click="showAddTabDialog = true"
        title="Добавить представление"
      >
        <i class="pi pi-plus"></i>
      </button>
    </div>

    <!-- Active tab content (cached with v-show for instant tab switching) -->
    <div class="tab-content">
      <template v-for="tab in tabs" :key="`tab-${tab.id}`">
        <!-- Table view -->
        <IntegramDataTableWrapper
          v-if="tab.viewType === 'table'"
          v-show="activeTabId === tab.id"
          :typeId="String(tab.typeId)"
          :database="database"
          @table-loaded="(data) => onTableLoaded(tab.id, data)"
        >
          <template #breadcrumb-actions>
            <button
              class="breadcrumb-add-tab-btn"
              @click="showAddTabDialog = true"
              title="Добавить представление"
            >
              <i class="pi pi-plus"></i>
            </button>
          </template>
        </IntegramDataTableWrapper>

        <!-- Cards view -->
        <IntegramCardsEmbed
          v-else-if="tab.viewType === 'cards'"
          v-show="activeTabId === tab.id"
          :database="database"
          :tableId="String(tab.typeId)"
          :tableName="tab.name"
          :initialSettings="tab.viewConfig"
          @settings-changed="(settings) => updateTabConfig(tab.id, settings)"
        />

        <!-- Chart view -->
        <div
          v-else-if="tab.viewType === 'chart'"
          v-show="activeTabId === tab.id"
          class="chart-view-container"
        >
          <div class="chart-placeholder">
            <i class="pi pi-chart-bar"></i>
            <p>График для таблицы {{ tab.name }}</p>
            <small>ID: {{ tab.typeId }}</small>
            <p class="chart-note">Интеграция с chart_embed будет добавлена в следующей версии</p>
          </div>
        </div>
      </template>
    </div>

    <!-- Add tab dialog -->
    <TabAddDialog
      v-model:visible="showAddTabDialog"
      :database="database"
      @add-tab="addTabFromDialog"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIntegramSession } from '@/composables/useIntegramSession'
import integramApiClient from '@/services/integramApiClient'
// Use defineAsyncComponent to avoid chunk conflicts with dynamic imports
const IntegramDataTableWrapper = defineAsyncComponent(() => import('@/components/integram/IntegramDataTableWrapper.vue'))
import IntegramCardsEmbed from '@/components/integram/IntegramCardsEmbed.vue'
import TabAddDialog from '@/components/integram/IntegramTabsEmbed/TabAddDialog.vue'

const route = useRoute()
const router = useRouter()
const { database: sessionDatabase } = useIntegramSession()

const database = computed(() => route.params.database || sessionDatabase.value || 'my')

// Tab state
const tabs = ref([])
const activeTabId = ref(null)
const tabIdCounter = ref(0)
const tabsContainer = ref(null)
const showAddTabDialog = ref(false)

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value))

// localStorage key for persisting tabs
const storageKey = computed(() => `integram_table_tabs_${database.value}`)

// Get icon for tab based on view type
function getTabIcon(viewType) {
  switch (viewType) {
    case 'cards':
      return 'pi pi-id-card'
    case 'chart':
      return 'pi pi-chart-bar'
    case 'table':
    default:
      return 'pi pi-table'
  }
}

// Generate unique tab ID
function generateTabId() {
  return ++tabIdCounter.value
}

// Create a tab object
function createTab(typeId, name = null, viewType = 'table', viewConfig = {}) {
  return {
    id: generateTabId(),
    typeId: String(typeId),
    name: name || `Таблица ${typeId}`,
    viewType: viewType || 'table',
    viewConfig: viewConfig || {},
    database: database.value
  }
}

// Initialize tabs from route or localStorage
function initTabs() {
  const routeTypeId = route.params.typeId
  if (!routeTypeId) return

  // Try to restore tabs from localStorage
  const saved = localStorage.getItem(storageKey.value)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        tabs.value = parsed.tabs.map(t => ({
          ...t,
          id: generateTabId(),
          viewType: t.viewType || 'table',
          viewConfig: t.viewConfig || {},
          database: t.database || database.value
        }))

        // Check if current route typeId is already in tabs
        const existingTab = tabs.value.find(t => String(t.typeId) === String(routeTypeId))
        if (existingTab) {
          activeTabId.value = existingTab.id
        } else {
          // Add the route typeId as a new tab and make it active
          const newTab = createTab(routeTypeId)
          tabs.value.push(newTab)
          activeTabId.value = newTab.id
        }
        return
      }
    } catch (_e) {
      // Invalid saved state, fall through to default
    }
  }

  // Default: create single tab from route
  const tab = createTab(routeTypeId)
  tabs.value = [tab]
  activeTabId.value = tab.id
}

// Save tabs to localStorage
function saveTabs() {
  const data = {
    tabs: tabs.value.map(t => ({
      typeId: t.typeId,
      name: t.name,
      viewType: t.viewType,
      viewConfig: t.viewConfig,
      database: t.database
    })),
    activeTypeId: activeTab.value?.typeId
  }
  localStorage.setItem(storageKey.value, JSON.stringify(data))
}

// Flag to distinguish our own URL updates from external navigation
let isInternalUrlUpdate = false

// Update the URL silently without triggering Vue Router reactivity
function updateUrlSilently(typeId) {
  const currentUrl = window.location.pathname + window.location.search + window.location.hash
  const newUrl = currentUrl.replace(
    /\/table\/[^/?#]+/,
    `/table/${typeId}`
  )
  if (newUrl !== currentUrl) {
    isInternalUrlUpdate = true
    window.history.replaceState(window.history.state, '', newUrl)
    setTimeout(() => { isInternalUrlUpdate = false }, 50)
  }
}

// Switch to a tab
function switchToTab(tabId) {
  const tab = tabs.value.find(t => t.id === tabId)
  if (!tab) return

  activeTabId.value = tabId
  updateUrlSilently(tab.typeId)
  saveTabs()
}

// Close a tab
function closeTab(tabId) {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  // Last tab — navigate to table list
  if (tabs.value.length === 1) {
    tabs.value = []
    saveTabs()
    router.push(`/integram/${database.value}/table`)
    return
  }

  // If closing the active tab, switch to adjacent tab
  if (activeTabId.value === tabId) {
    const newIndex = index === tabs.value.length - 1 ? index - 1 : index + 1
    const newActiveTab = tabs.value[newIndex]
    activeTabId.value = newActiveTab.id
    updateUrlSilently(newActiveTab.typeId)
  }

  tabs.value.splice(index, 1)
  saveTabs()
}

// Add tab from dialog
function addTabFromDialog(tabConfig) {
  const existing = tabs.value.find(t =>
    String(t.typeId) === String(tabConfig.typeId) &&
    t.viewType === tabConfig.viewType
  )

  if (existing) {
    // Switch to existing tab with same table and view type
    switchToTab(existing.id)
  } else {
    // Create new tab
    const newTab = createTab(
      tabConfig.typeId,
      tabConfig.name,
      tabConfig.viewType,
      tabConfig.viewConfig
    )
    tabs.value.push(newTab)
    switchToTab(newTab.id)
  }

  saveTabs()

  // Scroll to the new tab
  nextTick(() => {
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsContainer.value.scrollWidth
    }
  })
}

// Update tab viewConfig (called when settings change)
function updateTabConfig(tabId, newConfig) {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab) {
    tab.viewConfig = { ...tab.viewConfig, ...newConfig }
    saveTabs()
  }
}

// Handle table loaded event - update tab name
function onTableLoaded(tabId, data) {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab && data?.val) {
    tab.name = data.val
    saveTabs()
  }
}

// Watch for route changes (external navigation to a different typeId)
watch(() => route.params.typeId, (newTypeId) => {
  if (!newTypeId || isInternalUrlUpdate) return

  const existing = tabs.value.find(t => String(t.typeId) === String(newTypeId))
  if (existing) {
    // Just switch to the existing tab
    if (activeTabId.value !== existing.id) {
      activeTabId.value = existing.id
      saveTabs()
    }
  } else {
    // Open new tab for the navigated typeId
    const newTab = createTab(newTypeId)
    tabs.value.push(newTab)
    activeTabId.value = newTab.id
    saveTabs()
  }

  // Clean up newtab query param if present
  if (route.query.newtab) {
    const { newtab: _newtab, ...rest } = route.query
    router.replace({ params: route.params, query: rest })
  }
})

// Initialize on mount
onMounted(() => {
  initTabs()
})

// Expose for parent components
defineExpose({
  addTabFromDialog
})
</script>

<style scoped>
.integram-table-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabs-bar {
  display: flex;
  align-items: center;
  background: var(--surface-ground, #f8f9fa);
  border-bottom: 2px solid var(--surface-border, #dee2e6);
  padding: 0 1rem;
  min-height: 42px;
  overflow: hidden;
  position: relative;
}

.tabs-scroll-container {
  display: flex;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-400) transparent;
}

.tabs-scroll-container::-webkit-scrollbar {
  height: 4px;
}

.tabs-scroll-container::-webkit-scrollbar-thumb {
  background: var(--surface-400);
  border-radius: 3px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 0.875rem;
  border-right: 1px solid var(--surface-border, #dee2e6);
  transition: all 0.2s;
  user-select: none;
  max-width: 240px;
  min-width: 120px;
  position: relative;
  background: var(--surface-card, #ffffff);
}

.tab-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0;
  background: var(--p-primary-color, var(--primary-color, #3B82F6));
  transition: height 0.2s;
}

.tab-item:hover {
  background: var(--surface-hover, #e9ecef);
}

.tab-active {
  background: var(--surface-card, #ffffff);
  font-weight: 600;
  color: var(--p-primary-color, var(--primary-color, #3B82F6));
}

.tab-active::after {
  height: 3px;
}

.tab-active:hover {
  background: var(--surface-card, #ffffff);
}

.tab-icon {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  flex-shrink: 0;
}

.tab-active .tab-icon {
  color: var(--p-primary-color, var(--primary-color, #3B82F6));
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.tab-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 3px;
  padding: 0;
  margin-left: 4px;
  flex-shrink: 0;
  color: var(--text-color-secondary);
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

.tab-item:hover .tab-close-btn {
  opacity: 1;
}

.tab-close-btn:hover {
  background: var(--surface-300, #dee2e6);
  color: var(--text-color);
}

.tab-close-btn .pi {
  font-size: 0.7rem;
}

.tab-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 6px;
  flex-shrink: 0;
  color: var(--text-color-secondary);
  transition: all 0.2s;
  position: relative;
}

.tab-add-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  border: 1.5px dashed var(--surface-border);
  transition: border-color 0.2s;
}

.tab-add-btn:hover {
  background: var(--surface-hover, #e9ecef);
  color: var(--p-primary-color, var(--primary-color, #3B82F6));
}

.tab-add-btn:hover::before {
  border-color: var(--p-primary-color, var(--primary-color, #3B82F6));
}

.tab-add-btn .pi {
  font-size: 0.9rem;
  position: relative;
  z-index: 1;
}

.tab-content {
  flex: 1;
  overflow: auto;
}

/* Chart view placeholder */
.chart-view-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  color: var(--text-color-secondary);
}

.chart-placeholder i {
  font-size: 3rem;
  color: var(--p-primary-color, var(--primary-color, #3B82F6));
  opacity: 0.3;
}

.chart-placeholder p {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.chart-placeholder small {
  font-size: 0.75rem;
  opacity: 0.7;
}

.chart-note {
  margin-top: 8px;
  padding: 8px 16px;
  background: var(--surface-card);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-color);
}

/* Add tab button in breadcrumb area */
.breadcrumb-add-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--surface-border, #dee2e6);
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  color: var(--text-color-secondary);
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.breadcrumb-add-tab-btn:hover {
  background: var(--surface-hover, #e9ecef);
  color: var(--p-primary-color, var(--primary-color, #3B82F6));
  border-color: var(--p-primary-color, var(--primary-color, #3B82F6));
}

.breadcrumb-add-tab-btn .pi {
  font-size: 0.75rem;
}
</style>

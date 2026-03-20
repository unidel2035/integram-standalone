<template>
  <div class="integram-tabs-inner" @mousedown.stop @click.stop @dragstart.stop>
    <!-- Header with title and controls -->
    <div class="tabs-embed-header" v-if="!hideHeader">
      <div class="tabs-embed-title">
        <i class="pi pi-window-maximize"></i>
        <span>{{ title || 'Вкладки Integram' }}</span>
        <span v-if="localTabs.length" class="tabs-count">{{ localTabs.length }}</span>
      </div>
      <div class="tabs-embed-controls">
        <button
          class="ctrl-btn"
          title="Добавить представление"
          @click="showAddTabDialog = true"
        >
          <i class="pi pi-plus"></i>
        </button>
        <button
          class="ctrl-btn"
          title="Настройки"
          @click="showSettings = !showSettings"
        >
          <i class="pi pi-cog"></i>
        </button>
      </div>
    </div>

    <!-- Settings panel (collapsible) -->
    <div v-if="showSettings && !hideHeader" class="settings-panel">
      <div class="setting-row">
        <label>Заголовок блока</label>
        <InputText
          v-model="localTitle"
          placeholder="Название блока..."
          class="w-full"
          @blur="saveSettings"
        />
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="localHideHeader" @change="saveSettings" />
          <span>Скрыть шапку блока</span>
        </label>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="tabs-bar" v-if="localTabs.length > 0">
      <div class="tabs-scroll-container" ref="tabsContainer">
        <div
          v-for="(tab, index) in localTabs"
          :key="tab.id"
          class="tab-item"
          :class="{ 'tab-active': activeTabId === tab.id, 'tab-dragging': draggingTabId === tab.id }"
          :style="getTabStyle(index)"
          @click="handleTabClick(tab.id, $event)"
          @dblclick="startRenameTab(tab.id)"
          @contextmenu.prevent="openContextMenu(tab.id, $event)"
          :title="tab.name || `Таблица ${tab.typeId}`"
          draggable="true"
          @dragstart="handleDragStart(tab.id, $event)"
          @dragover.prevent="handleDragOver(tab.id, $event)"
          @drop="handleDrop(tab.id, $event)"
          @dragend="handleDragEnd"
        >
          <div class="tab-item-inner" v-if="renamingTabId !== tab.id">
            <i :class="getTabIcon(tab.viewType)" class="tab-icon"></i>
            <span class="tab-label">{{ tab.name || `Таблица ${tab.typeId}` }}</span>
            <button
              class="tab-menu-btn"
              @click.stop="openContextMenu(tab.id, $event)"
              title="Меню вкладки"
            >
              <i class="pi pi-ellipsis-v"></i>
            </button>
            <button
              class="tab-close-btn"
              @click.stop="removeTab(tab.id)"
              title="Закрыть"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
          <!-- Inline rename input -->
          <div class="tab-item-inner" v-else>
            <i :class="getTabIcon(tab.viewType)" class="tab-icon"></i>
            <input
              ref="renameInput"
              v-model="renameValue"
              class="tab-rename-input"
              @blur="finishRename"
              @keydown.enter="finishRename"
              @keydown.esc="cancelRename"
              @click.stop
            />
          </div>
        </div>
        <button
          class="tab-add-btn"
          @click="showAddTabDialog = true"
          title="Добавить представление"
        >
          <i class="pi pi-plus"></i>
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <Menu ref="contextMenu" :model="contextMenuItems" :popup="true" />

    <!-- Tab content -->
    <div class="tab-content">
      <template v-if="localTabs.length === 0">
        <div class="empty-state">
          <i class="pi pi-window-maximize"></i>
          <p>Нет вкладок</p>
          <button class="add-first-tab-btn" @click="showAddTabDialog = true">
            <i class="pi pi-plus mr-2"></i>
            Добавить первую вкладку
          </button>
        </div>
      </template>
      <template v-else>
        <template v-for="tab in localTabs" :key="`tab-${tab.id}`">
          <!-- Table view: lazy mount — only when tab has been visited at least once -->
          <IntegramDataTableWrapper
            v-if="tab.viewType === 'table' && mountedTabIds.includes(tab.id)"
            v-show="activeTabId === tab.id"
            :typeId="String(tab.typeId)"
            :database="tab.database || database"
            :blockId="blockId || undefined"
            :disableAutoLoadAll="true"
            :tabId="tab.id"
            :columnVisibility="tab.columnVisibility"
            :initialFilterConditions="tab.viewConfig?.filterConditions || []"
            @update:columnVisibility="(visibility) => updateTabColumnVisibility(tab.id, visibility)"
            @settings-updated="(s) => updateTabSettings(tab.id, s)"
          />

          <!-- Cards view -->
          <IntegramCardsEmbed
            v-else-if="tab.viewType === 'cards' && mountedTabIds.includes(tab.id)"
            v-show="activeTabId === tab.id"
            :database="tab.database || database"
            :tableId="String(tab.typeId)"
            :tableName="tab.name"
            :initialSettings="tab.viewConfig"
            @settings-changed="(settings) => updateTabConfig(tab.id, settings)"
          />

          <!-- Chart view -->
          <IntegramChartEmbed
            v-else-if="tab.viewType === 'chart' && mountedTabIds.includes(tab.id)"
            v-show="activeTabId === tab.id"
            :database="tab.database || database"
            :typeId="String(tab.typeId)"
            :initialSettings="tab.chartSettings"
            @settings-changed="(settings) => updateTabChartSettings(tab.id, settings)"
          />

          <!-- SmartReport view -->
          <SmartQViewer
            v-else-if="tab.viewType === 'smartreport' && mountedTabIds.includes(tab.id)"
            v-show="activeTabId === tab.id"
            :reportId="tab.reportId"
            :database="tab.database || database"
            :editable="true"
          />

          <!-- Calendar view -->
          <CalendarBlock
            v-else-if="tab.viewType === 'calendar' && mountedTabIds.includes(tab.id)"
            v-show="activeTabId === tab.id"
            :database="tab.database || database"
            :typeId="String(tab.typeId)"
            :settings="tab.calendarSettings"
            @settings-change="(settings) => updateTabCalendarSettings(tab.id, settings)"
          />

          <!-- Timeline view -->
          <TimelineBlock
            v-else-if="tab.viewType === 'timeline' && mountedTabIds.includes(tab.id)"
            v-show="activeTabId === tab.id"
            :database="tab.database || database"
            :typeId="String(tab.typeId)"
            :settings="tab.timelineSettings"
            @settings-change="(settings) => updateTabTimelineSettings(tab.id, settings)"
          />
        </template>
      </template>
    </div>

    <!-- Add tab dialog -->
    <TabAddDialog
      v-model:visible="showAddTabDialog"
      :database="database"
      @add-tab="addTab"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, defineAsyncComponent } from 'vue'
// Use defineAsyncComponent to avoid chunk conflicts with dynamic imports
const IntegramDataTableWrapper = defineAsyncComponent(() => import('@/components/integram/IntegramDataTableWrapper.vue'))
import IntegramCardsEmbed from '@/components/integram/IntegramCardsEmbed.vue'
import IntegramChartEmbed from '@/components/integram/IntegramChartEmbed.vue'
import SmartQViewer from '@/components/integram/SmartQViewer.vue'
import CalendarBlock from '@/components/editor/CalendarBlock.vue'
import TimelineBlock from '@/components/editor/TimelineBlock.vue'
import TabAddDialog from '@/components/integram/IntegramTabsEmbed/TabAddDialog.vue'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'

const props = defineProps({
  database: { type: String, default: 'my' },
  // Initial configuration from block metadata
  initialTabs: { type: Array, default: () => [] },
  initialActiveTabId: { type: String, default: null },
  title: { type: String, default: '' },
  hideHeader: { type: Boolean, default: false },
  // Block ID for persisting changes
  blockId: { type: [String, Number], default: null }
})

const emit = defineEmits(['update:tabs', 'update:activeTabId', 'update:settings'])

// Local state
const localTabs = ref([])
const activeTabId = ref(null)
// Lazy mount: only mount tabs that have been visited at least once.
// Once mounted, keep in DOM (v-show) to preserve state and avoid re-loading.
const mountedTabIds = ref([])
const showAddTabDialog = ref(false)
const showSettings = ref(false)
const localTitle = ref('')
const localHideHeader = ref(false)
const tabsContainer = ref(null)
const contextMenu = ref(null)
const renameInput = ref(null)

// Tab management state
const renamingTabId = ref(null)
const renameValue = ref('')
const draggingTabId = ref(null)
const currentContextTabId = ref(null)

let tabIdCounter = 0

// PrimeVue palette colors (500 = solid, насыщенные)
const TAB_PALETTE = [
  { color: 'var(--p-blue-500,   #3b82f6)', border: 'var(--p-blue-200,   #bfdbfe)' },
  { color: 'var(--p-green-500,  #22c55e)', border: 'var(--p-green-200,  #bbf7d0)' },
  { color: 'var(--p-amber-500,  #f59e0b)', border: 'var(--p-amber-200,  #fde68a)' },
  { color: 'var(--p-red-500,    #ef4444)', border: 'var(--p-red-200,    #fecaca)' },
  { color: 'var(--p-violet-500, #8b5cf6)', border: 'var(--p-violet-200, #ddd6fe)' },
  { color: 'var(--p-orange-500, #f97316)', border: 'var(--p-orange-200, #fed7aa)' },
  { color: 'var(--p-teal-500,   #14b8a6)', border: 'var(--p-teal-200,   #99f6e4)' },
  { color: 'var(--p-pink-500,   #ec4899)', border: 'var(--p-pink-200,   #fbcfe8)' },
]

function getTabStyle(index) {
  const p = TAB_PALETTE[index % TAB_PALETTE.length]
  return {
    '--tab-color':  p.color,
    '--tab-border': p.border,
  }
}

// Get icon for tab based on view type
function getTabIcon(viewType) {
  switch (viewType) {
    case 'cards':
      return 'pi pi-id-card'
    case 'chart':
      return 'pi pi-chart-bar'
    case 'smartreport':
      return 'pi pi-list'
    case 'calendar':
      return 'pi pi-calendar'
    case 'timeline':
      return 'pi pi-bars'
    case 'table':
    default:
      return 'pi pi-table'
  }
}

// Generate unique tab ID
function generateTabId() {
  return `tab_${Date.now()}_${++tabIdCounter}_${Math.random().toString(36).substr(2, 9)}`
}

// Initialize tabs from props
function initTabs() {
  if (props.initialTabs && props.initialTabs.length > 0) {
    localTabs.value = props.initialTabs.map(t => ({
      ...t,
      id: t.id || generateTabId()
    }))
    activeTabId.value = props.initialActiveTabId || localTabs.value[0]?.id
  } else {
    localTabs.value = []
    activeTabId.value = null
  }

  // Only mount the initially active tab — others load on first click
  mountedTabIds.value = activeTabId.value ? [activeTabId.value] : []

  localTitle.value = props.title || ''
  localHideHeader.value = props.hideHeader || false
}

// Handle tab click (separate from double-click)
function handleTabClick(tabId, event) {
  // Only switch if not renaming
  if (renamingTabId.value === null) {
    switchToTab(tabId)
  }
}

// Switch to a tab
function switchToTab(tabId) {
  activeTabId.value = tabId
  // Mark tab as mounted so it stays in DOM after first activation
  if (!mountedTabIds.value.includes(tabId)) {
    mountedTabIds.value.push(tabId)
  }
  emitChanges()
}

// ────────────────────────────────────────────────────────────────────
// Tab Renaming
// ────────────────────────────────────────────────────────────────────

function startRenameTab(tabId) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (!tab) return

  renamingTabId.value = tabId
  renameValue.value = tab.name || `Таблица ${tab.typeId}`

  // Focus the input after render
  nextTick(() => {
    if (renameInput.value) {
      const input = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
      if (input) {
        input.focus()
        input.select()
      }
    }
  })
}

function finishRename() {
  if (renamingTabId.value === null) return

  const tab = localTabs.value.find(t => t.id === renamingTabId.value)
  if (tab && renameValue.value.trim()) {
    tab.name = renameValue.value.trim()
    emitChanges()
  }

  renamingTabId.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingTabId.value = null
  renameValue.value = ''
}

// ────────────────────────────────────────────────────────────────────
// Drag and Drop Reordering
// ────────────────────────────────────────────────────────────────────

function handleDragStart(tabId, event) {
  draggingTabId.value = tabId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', tabId)
}

function handleDragOver(targetTabId, event) {
  if (draggingTabId.value === null || draggingTabId.value === targetTabId) return

  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

function handleDrop(targetTabId, event) {
  event.preventDefault()

  if (draggingTabId.value === null || draggingTabId.value === targetTabId) return

  const dragIndex = localTabs.value.findIndex(t => t.id === draggingTabId.value)
  const dropIndex = localTabs.value.findIndex(t => t.id === targetTabId)

  if (dragIndex === -1 || dropIndex === -1) return

  // Reorder tabs
  const [draggedTab] = localTabs.value.splice(dragIndex, 1)
  localTabs.value.splice(dropIndex, 0, draggedTab)

  emitChanges()
}

function handleDragEnd() {
  draggingTabId.value = null
}

// ────────────────────────────────────────────────────────────────────
// Tab Moving (via buttons)
// ────────────────────────────────────────────────────────────────────

function moveTabLeft(tabId) {
  const index = localTabs.value.findIndex(t => t.id === tabId)
  if (index <= 0) return // Already at the start

  // Swap with previous tab
  const temp = localTabs.value[index - 1]
  localTabs.value[index - 1] = localTabs.value[index]
  localTabs.value[index] = temp

  emitChanges()
}

function moveTabRight(tabId) {
  const index = localTabs.value.findIndex(t => t.id === tabId)
  if (index === -1 || index >= localTabs.value.length - 1) return // Already at the end

  // Swap with next tab
  const temp = localTabs.value[index + 1]
  localTabs.value[index + 1] = localTabs.value[index]
  localTabs.value[index] = temp

  emitChanges()
}

// ────────────────────────────────────────────────────────────────────
// Tab Copying
// ────────────────────────────────────────────────────────────────────

function copyTab(tabId) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (!tab) return

  const index = localTabs.value.findIndex(t => t.id === tabId)

  // Create copy with new ID
  const copiedTab = {
    ...JSON.parse(JSON.stringify(tab)), // Deep clone
    id: generateTabId(),
    name: `Копия ${tab.name || `Таблица ${tab.typeId}`}`
  }

  // Insert after the original
  localTabs.value.splice(index + 1, 0, copiedTab)

  // Switch to the copied tab
  activeTabId.value = copiedTab.id
  if (!mountedTabIds.value.includes(copiedTab.id)) {
    mountedTabIds.value.push(copiedTab.id)
  }

  emitChanges()
}

// ────────────────────────────────────────────────────────────────────
// Context Menu
// ────────────────────────────────────────────────────────────────────

const contextMenuItems = computed(() => {
  if (!currentContextTabId.value) return []

  const tabIndex = localTabs.value.findIndex(t => t.id === currentContextTabId.value)
  const isFirst = tabIndex === 0
  const isLast = tabIndex === localTabs.value.length - 1

  return [
    {
      label: 'Переименовать',
      icon: 'pi pi-pencil',
      command: () => startRenameTab(currentContextTabId.value)
    },
    { separator: true },
    {
      label: 'Переместить влево',
      icon: 'pi pi-arrow-left',
      disabled: isFirst,
      command: () => moveTabLeft(currentContextTabId.value)
    },
    {
      label: 'Переместить вправо',
      icon: 'pi pi-arrow-right',
      disabled: isLast,
      command: () => moveTabRight(currentContextTabId.value)
    },
    { separator: true },
    {
      label: 'Копировать вкладку',
      icon: 'pi pi-copy',
      command: () => copyTab(currentContextTabId.value)
    },
    { separator: true },
    {
      label: 'Удалить вкладку',
      icon: 'pi pi-trash',
      command: () => removeTab(currentContextTabId.value)
    }
  ]
})

function openContextMenu(tabId, event) {
  currentContextTabId.value = tabId
  contextMenu.value.show(event)
}

// Add tab from dialog
function addTab(tabConfig) {
  const newTab = {
    ...tabConfig,
    id: tabConfig.id || generateTabId()
  }

  localTabs.value.push(newTab)
  activeTabId.value = newTab.id
  if (!mountedTabIds.value.includes(newTab.id)) {
    mountedTabIds.value.push(newTab.id)
  }
  emitChanges()

  // Scroll to the new tab
  setTimeout(() => {
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsContainer.value.scrollWidth
    }
  }, 100)
}

// Remove tab
function removeTab(tabId) {
  const index = localTabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  // If removing the active tab, switch to adjacent tab
  if (activeTabId.value === tabId && localTabs.value.length > 1) {
    const newIndex = index === localTabs.value.length - 1 ? index - 1 : index + 1
    activeTabId.value = localTabs.value[newIndex].id
  } else if (localTabs.value.length === 1) {
    activeTabId.value = null
  }

  localTabs.value.splice(index, 1)
  emitChanges()
}

// Update tab viewConfig
function updateTabConfig(tabId, newConfig) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (tab) {
    tab.viewConfig = { ...tab.viewConfig, ...newConfig }
    emitChanges()
  }
}

// Update tab column visibility
function updateTabColumnVisibility(tabId, visibility) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (tab) {
    tab.columnVisibility = visibility
    emitChanges()
  }
}

// Update tab settings from IntegramDataTableWrapper (filters, etc.)
function updateTabSettings(tabId, settings) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (!tab) return
  if (!tab.viewConfig) tab.viewConfig = {}
  if (settings.filterConditions !== undefined) {
    tab.viewConfig = { ...tab.viewConfig, filterConditions: settings.filterConditions }
    emitChanges()
  }
}

// Update chart settings
function updateTabChartSettings(tabId, settings) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (tab) {
    tab.chartSettings = settings
    emitChanges()
  }
}

// Update calendar settings
function updateTabCalendarSettings(tabId, settings) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (tab) {
    tab.calendarSettings = settings
    emitChanges()
  }
}

// Update timeline settings
function updateTabTimelineSettings(tabId, settings) {
  const tab = localTabs.value.find(t => t.id === tabId)
  if (tab) {
    tab.timelineSettings = settings
    emitChanges()
  }
}

// Save settings
function saveSettings() {
  emitChanges()
}

// Emit changes to parent
function emitChanges() {
  emit('update:tabs', localTabs.value)
  emit('update:activeTabId', activeTabId.value)
  emit('update:settings', {
    title: localTitle.value,
    hideHeader: localHideHeader.value
  })
}

// Initialize on mount
onMounted(() => {
  initTabs()
})

// Watch for prop changes
watch(() => props.initialTabs, () => {
  initTabs()
}, { deep: true })
</script>

<style scoped>
.integram-tabs-inner {
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 10px;
  background: var(--p-content-background, #fff);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

/* ── Header ─────────────────────────────────────────────────────── */
.tabs-embed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--p-content-background, #f8fafc);
  border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
  gap: 10px;
}

.tabs-embed-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--p-text-color, #1e293b);
}

.tabs-count {
  background: var(--p-content-border-color, #e2e8f0);
  color: var(--p-text-muted-color, #475569);
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
}

.tabs-embed-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ctrl-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 5px;
  background: var(--p-content-background, white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color, #64748b);
  transition: all 0.15s;
  font-size: 12px;
}

.ctrl-btn:hover {
  background: var(--p-content-hover-background, #f1f5f9);
  color: var(--p-primary-color, #6366f1);
  border-color: var(--p-primary-color, #6366f1);
}

/* ── Settings panel ─────────────────────────────────────────────── */
.settings-panel {
  padding: 12px 14px;
  background: var(--p-content-hover-background, #f8fafc);
  border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-row label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #64748b);
  display: flex;
  align-items: center;
  gap: 6px;
}

.setting-row input[type="checkbox"] {
  margin: 0;
}

/* ── Tab bar ────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  align-items: flex-end;
  background: var(--surface-ground, #f1f5f9);
  border-bottom: 2px solid var(--surface-border, #e2e8f0);
  padding: 6px 8px 0 8px;
  gap: 4px;
  position: relative;
  z-index: 2;
}

.tabs-scroll-container {
  display: flex;
  overflow-x: auto;
  flex: 1;
  gap: 4px;
  align-items: flex-end;
  scrollbar-width: none;
}

.tabs-scroll-container::-webkit-scrollbar {
  display: none;
}

/* ── Вкладка: полоса 1/5 высоты сверху + эффект бумажного файла ── */
.tab-item {
  display: flex;
  align-items: stretch;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
  font-size: 0.8125rem;
  border: 1px solid var(--tab-border, #cbd5e1);
  border-bottom: 2px solid var(--surface-border, #e2e8f0);
  border-radius: 8px 8px 0 0;
  transition: filter 0.15s;
  user-select: none;
  max-width: 210px;
  min-width: 110px;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  /* Острая цветная полоса: ровно 1/5 высоты сверху, остальное белое */
  background: linear-gradient(
    to bottom,
    var(--tab-color, #3b82f6) 0%,
    var(--tab-color, #3b82f6) 20%,
    var(--surface-card, #fff) 20%
  );
  color: var(--text-color, #374151);
}

/* Внутренний контейнер для паддинга */
.tab-item-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 7px 12px;
  width: 100%;
}

.tab-item:hover {
  filter: brightness(0.96);
}

/* Активная вкладка: полная заливка цветом + нижняя линия исчезает (эффект открытой папки) */
.tab-active {
  font-weight: 600;
  border-color: var(--tab-border, #cbd5e1);
  border-bottom-color: var(--surface-card, #fff);
  margin-bottom: -2px;
  z-index: 2;
  filter: none;
  background: var(--tab-color, #3b82f6);
  color: var(--p-primary-contrast-color, #fff);
}

.tab-active .tab-icon {
  color: var(--p-primary-contrast-color, #fff);
}

.tab-active .tab-close-btn {
  color: color-mix(in srgb, var(--p-primary-contrast-color, #fff) 80%, transparent);
}

.tab-active .tab-close-btn:hover {
  background: color-mix(in srgb, var(--p-primary-contrast-color, #fff) 20%, transparent);
  color: var(--p-primary-contrast-color, #fff);
}

.tab-icon {
  font-size: 0.8rem;
  flex-shrink: 0;
  color: var(--tab-color, #3b82f6);
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  color: var(--text-color-secondary, #64748b);
  font-size: 9px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.tab-menu-btn:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--tab-color, #3b82f6) 15%, transparent);
}

.tab-item:hover .tab-menu-btn {
  opacity: 0.85;
}

.tab-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  color: var(--text-color-secondary, #64748b);
  font-size: 9px;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
}

.tab-close-btn:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--tab-color, #3b82f6) 15%, transparent);
}

.tab-item:hover .tab-close-btn {
  opacity: 0.85;
}

/* Tab rename input */
.tab-rename-input {
  flex: 1;
  border: 1px solid var(--p-primary-color, #6366f1);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.8125rem;
  font-family: inherit;
  background: var(--surface-card, #fff);
  color: var(--text-color, #374151);
  outline: none;
}

/* Dragging state */
.tab-dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.tab-item[draggable="true"] {
  cursor: grab;
}

.tab-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-width: 36px;
  padding: 8px 0 7px;
  border: 1px dashed var(--surface-border, #cbd5e1);
  border-bottom: 2px solid var(--surface-border, #e2e8f0);
  background: transparent;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  flex-shrink: 0;
  color: var(--text-color-secondary, #94a3b8);
  transition: all 0.15s;
  font-size: 0.8rem;
  align-self: flex-end;
}

.tab-add-btn:hover {
  border-color: var(--p-primary-color, #6366f1);
  border-style: solid;
  color: var(--p-primary-color, #6366f1);
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 8%, transparent);
}

/* ── Tab content ────────────────────────────────────────────────── */
.tab-content {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  min-height: 300px;
  color: var(--text-color-secondary);
}

.empty-state i {
  font-size: 3rem;
  opacity: 0.3;
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.add-first-tab-btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border: 1px solid var(--p-primary-color);
  background: var(--p-primary-color);
  color: white;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  margin-top: 8px;
}

.add-first-tab-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

</style>

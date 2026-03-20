<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Добавить представление"
    :modal="true"
    :style="{ width: '550px' }"
    :breakpoints="{ '640px': '95vw' }"
  >
    <div class="tab-add-dialog-content">
      <!-- Step 1: Select table -->
      <div class="form-section">
        <label class="form-label">Выберите таблицу</label>
        <div class="table-selector-search mb-3">
          <IconField iconPosition="left" class="w-full">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="tableSearchQuery"
              placeholder="Поиск по названию или ID..."
              class="w-full"
              @input="searchTables"
              autofocus
            />
          </IconField>
        </div>
        <div v-if="tableSearchLoading" class="text-center py-3">
          <ProgressSpinner style="width: 30px; height: 30px" />
        </div>
        <div v-else-if="availableTables.length > 0" class="table-selector-list">
          <div
            v-for="table in availableTables"
            :key="table.id"
            class="table-selector-item"
            :class="{ selected: selectedTableId === table.id }"
            @click="selectTable(table)"
          >
            <i class="pi pi-table mr-2"></i>
            <span class="table-selector-name">{{ table.name }}</span>
            <Badge v-if="table.id" :value="table.id" severity="secondary" class="ml-auto table-selector-badge" />
          </div>
        </div>
        <div v-else-if="tableSearchQuery && tableSearchQuery.trim()" class="text-center py-3">
          <div class="text-color-secondary mb-3">Таблицы не найдены</div>
          <button
            v-if="/^\d+$/.test(tableSearchQuery.trim())"
            class="open-by-id-btn"
            @click="selectTableById(tableSearchQuery.trim())"
          >
            <i class="pi pi-external-link mr-2"></i>
            Открыть таблицу с ID {{ tableSearchQuery.trim() }}
          </button>
        </div>
      </div>

      <!-- Step 2: Select view type -->
      <div class="form-section" v-if="selectedTableId">
        <label class="form-label">Тип представления</label>
        <div class="view-type-selector">
          <div
            class="view-type-option"
            :class="{ selected: viewType === 'table' }"
            @click="viewType = 'table'"
          >
            <i class="pi pi-table"></i>
            <span>Таблица</span>
            <div class="view-type-desc">Полноценная таблица с сортировкой и фильтрами</div>
          </div>
          <div
            class="view-type-option"
            :class="{ selected: viewType === 'cards' }"
            @click="viewType = 'cards'"
          >
            <i class="pi pi-id-card"></i>
            <span>Карточки</span>
            <div class="view-type-desc">Карточки (grid / list / kanban)</div>
          </div>
          <div
            class="view-type-option"
            :class="{ selected: viewType === 'chart' }"
            @click="viewType = 'chart'"
          >
            <i class="pi pi-chart-bar"></i>
            <span>Диаграмма</span>
            <div class="view-type-desc">График по данным таблицы</div>
          </div>
          <div
            class="view-type-option"
            :class="{ selected: viewType === 'smartreport' }"
            @click="viewType = 'smartreport'"
          >
            <i class="pi pi-list"></i>
            <span>Умный отчёт</span>
            <div class="view-type-desc">SmartQ отчёт с анализом данных</div>
          </div>
          <div
            class="view-type-option"
            :class="{ selected: viewType === 'calendar' }"
            @click="viewType = 'calendar'"
          >
            <i class="pi pi-calendar"></i>
            <span>Календарь</span>
            <div class="view-type-desc">Календарное представление событий</div>
          </div>
          <div
            class="view-type-option"
            :class="{ selected: viewType === 'timeline' }"
            @click="viewType = 'timeline'"
          >
            <i class="pi pi-bars"></i>
            <span>Таймлайн</span>
            <div class="view-type-desc">Временная шкала событий</div>
          </div>
        </div>
      </div>

      <!-- Step 3: Tab name -->
      <div class="form-section" v-if="selectedTableId && viewType">
        <label class="form-label">Название вкладки</label>
        <InputText
          v-model="tabName"
          placeholder="Название вкладки..."
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Отмена" text @click="$emit('update:visible', false)" />
      <Button
        label="Добавить"
        :disabled="!selectedTableId || !viewType"
        @click="addTab"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import integramApiClient from '@/services/integramApiClient'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Badge from 'primevue/badge'
import ProgressSpinner from 'primevue/progressspinner'

const props = defineProps({
  visible: { type: Boolean, required: true },
  database: { type: String, default: 'my' }
})

const emit = defineEmits(['update:visible', 'add-tab'])

// State
const tableSearchQuery = ref('')
const tableSearchLoading = ref(false)
const availableTables = ref([])
const selectedTableId = ref(null)
const selectedTableName = ref('')
const viewType = ref('table')
const tabName = ref('')
let searchDebounceTimer = null

// Cache for all types list
let cachedAllTypes = null

// Load all types from multiple sources
async function loadAllTypes() {
  if (cachedAllTypes) return cachedAllTypes

  const typesMap = new Map()

  function addType(id, name, alias) {
    id = String(id)
    if (!id || id === 'undefined' || id === 'null') return
    const existing = typesMap.get(id)
    if (existing) {
      if (alias && !existing.alias) existing.alias = alias
      if (name && existing.name.startsWith('Таблица ')) existing.name = name
    } else {
      typesMap.set(id, { name: name || `Таблица ${id}`, alias: alias || null })
    }
  }

  // Source 1: getDictionary()
  try {
    const dict = await integramApiClient.getDictionary()
    if (dict && typeof dict === 'object') {
      if (dict.type && Array.isArray(dict.type)) {
        for (const t of dict.type) {
          addType(t.id || t.ID, t.val || t.name, t.alias)
        }
      } else {
        for (const [id, name] of Object.entries(dict)) {
          if (id && name && typeof name === 'string') {
            addType(id, name, null)
          }
        }
      }
    }
  } catch (err) {
    console.warn('[TabAddDialog] getDictionary failed:', err)
  }

  // Source 2 & 3: Load terms and metadata in parallel
  const [termsResult, metadataResult] = await Promise.allSettled([
    integramApiClient.getTerms().catch(err => {
      console.warn('[TabAddDialog] getTerms failed:', err)
      return null
    }),
    integramApiClient.getAllTypesMetadata().catch(err => {
      console.warn('[TabAddDialog] getAllTypesMetadata failed:', err)
      return null
    })
  ])

  const terms = termsResult.status === 'fulfilled' ? termsResult.value : null
  if (terms && Array.isArray(terms)) {
    for (const t of terms) {
      addType(t.id || t.ID, t.name || t.val, t.alias)
    }
  }

  const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : null
  if (metadata) {
    if (Array.isArray(metadata)) {
      for (const t of metadata) {
        addType(t.id || t.ID, t.val || t.name, t.alias)
      }
    } else if (typeof metadata === 'object') {
      for (const [id, data] of Object.entries(metadata)) {
        const name = typeof data === 'string' ? data : (data?.val || data?.name)
        const alias = typeof data === 'object' ? data?.alias : null
        addType(id, name, alias)
      }
    }
  }

  cachedAllTypes = Array.from(typesMap.entries()).map(([id, entry]) => ({
    id,
    name: entry.alias || entry.name,
    originalName: entry.name,
    alias: entry.alias
  }))
  return cachedAllTypes
}

// Preload types when dialog opens
async function preloadTypes() {
  tableSearchLoading.value = true
  try {
    const allTypes = await loadAllTypes()
    availableTables.value = allTypes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .slice(0, 100)
  } catch (err) {
    console.error('[TabAddDialog] Failed to preload types:', err)
  } finally {
    tableSearchLoading.value = false
  }
}

// Search tables
async function searchTables() {
  clearTimeout(searchDebounceTimer)

  const query = (tableSearchQuery.value || '').toLowerCase().trim()

  if (!query) {
    preloadTypes()
    return
  }

  searchDebounceTimer = setTimeout(async () => {
    tableSearchLoading.value = true
    try {
      const allTypes = await loadAllTypes()

      availableTables.value = allTypes
        .filter(t => {
          return t.name.toLowerCase().includes(query) ||
            (t.originalName && t.originalName.toLowerCase().includes(query)) ||
            (t.alias && t.alias.toLowerCase().includes(query)) ||
            t.id.includes(query)
        })
        .sort((a, b) => {
          if (a.id === query) return -1
          if (b.id === query) return 1
          if (a.name.toLowerCase() === query) return -1
          if (b.name.toLowerCase() === query) return 1
          const aIdMatch = a.id.startsWith(query)
          const bIdMatch = b.id.startsWith(query)
          if (aIdMatch && !bIdMatch) return -1
          if (!aIdMatch && bIdMatch) return 1
          const aNameStart = a.name.toLowerCase().startsWith(query)
          const bNameStart = b.name.toLowerCase().startsWith(query)
          if (aNameStart && !bNameStart) return -1
          if (!aNameStart && bNameStart) return 1
          return a.name.localeCompare(b.name, 'ru')
        })
        .slice(0, 100)
    } catch (err) {
      console.error('[TabAddDialog] Failed to search tables:', err)
      availableTables.value = []
    } finally {
      tableSearchLoading.value = false
    }
  }, 200)
}

// Select table
function selectTable(table) {
  selectedTableId.value = table.id
  selectedTableName.value = table.name
  if (!tabName.value) {
    tabName.value = table.name
  }
}

// Select table by ID
function selectTableById(id) {
  selectedTableId.value = id
  selectedTableName.value = `Таблица ${id}`
  if (!tabName.value) {
    tabName.value = `Таблица ${id}`
  }
}

// Add tab
function addTab() {
  if (!selectedTableId.value || !viewType.value) return

  const tabConfig = {
    id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: tabName.value || selectedTableName.value,
    typeId: selectedTableId.value,
    database: props.database,
    viewType: viewType.value,
    viewConfig: {}
  }

  // Add view-specific initial configs
  if (viewType.value === 'smartreport') {
    // For smartreport, we'll use the typeId as reportId initially
    // User can configure it later if needed
    tabConfig.reportId = selectedTableId.value
  } else if (viewType.value === 'chart') {
    tabConfig.chartSettings = {
      chartType: 'bar',
      labelField: '',
      valueField: '',
      title: tabName.value || selectedTableName.value,
      height: 400
    }
  } else if (viewType.value === 'calendar') {
    tabConfig.calendarSettings = {
      dateField: null,
      titleField: null
    }
  } else if (viewType.value === 'timeline') {
    tabConfig.timelineSettings = {
      startDateField: null,
      endDateField: null,
      titleField: null
    }
  }

  emit('add-tab', tabConfig)
  emit('update:visible', false)

  // Reset form
  selectedTableId.value = null
  selectedTableName.value = ''
  viewType.value = 'table'
  tabName.value = ''
  tableSearchQuery.value = ''
}

// Watch for dialog opening
watch(() => props.visible, (visible) => {
  if (visible) {
    tableSearchQuery.value = ''
    preloadTypes()
  }
})
</script>

<style scoped>
.tab-add-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
}

.table-selector-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
}

.table-selector-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--surface-border);
  transition: background-color 0.15s;
}

.table-selector-item:last-child {
  border-bottom: none;
}

.table-selector-item:hover {
  background: var(--surface-hover, #e9ecef);
}

.table-selector-item.selected {
  background: var(--primary-50);
  border-left: 3px solid var(--primary-color);
}

.table-selector-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-selector-badge {
  flex-shrink: 0;
}

.view-type-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.view-type-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.view-type-option:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.view-type-option.selected {
  border-color: var(--primary-color);
  background: var(--primary-50);
}

.view-type-option i {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: var(--text-color-secondary);
}

.view-type-option.selected i {
  color: var(--primary-color);
}

.view-type-option span {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.view-type-desc {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  line-height: 1.3;
}

.open-by-id-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid var(--primary-color);
  background: transparent;
  color: var(--primary-color);
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: all 0.15s;
}

.open-by-id-btn:hover {
  background: var(--primary-color);
  color: white;
}
</style>

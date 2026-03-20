<template>
  <div class="integram-cards-embed" @mousedown.stop @click.stop @dragstart.stop>
    <!-- Header -->
    <div class="cards-embed-header">
      <div class="cards-embed-title">
        <i class="pi pi-id-card"></i>
        <span>{{ tableName || 'Карточки' }}</span>
        <span v-if="displayedCards.length" class="cards-count">{{ displayedCards.length }}</span>
        <span v-if="hasActiveFilters" class="filter-badge" title="Активные фильтры">
          <i class="pi pi-filter-fill"></i>
        </span>
      </div>
      <div class="cards-embed-controls">
        <!-- View mode buttons — always visible -->
        <button
          class="ctrl-btn"
          :class="{ active: settings.viewMode === 'grid' && settings.groupDirection !== 'vertical' }"
          title="Карточки"
          @click="switchHeaderMode('grid')"
        >
          <i class="pi pi-th-large"></i>
        </button>
        <button
          class="ctrl-btn"
          :class="{ active: settings.viewMode === 'list' && settings.groupDirection !== 'vertical' }"
          title="Список"
          @click="switchHeaderMode('list')"
        >
          <i class="pi pi-list"></i>
        </button>
        <button
          class="ctrl-btn"
          :class="{ active: settings.groupDirection === 'vertical' }"
          title="Kanban"
          @click="switchHeaderMode('kanban')"
        >
          <i class="pi pi-table"></i>
        </button>

        <!-- Фильтр (серверная фильтрация через composable) -->
        <button
          class="ctrl-btn"
          :class="{ active: serverFilters.hasActiveFilters.value }"
          :title="serverFilters.hasActiveFilters.value ? 'Фильтры активны' : 'Фильтры'"
          @click="serverFilters.openFilterDialog(filterableFieldsNormalized)"
        >
          <i :class="serverFilters.hasActiveFilters.value ? 'pi pi-filter-fill' : 'pi pi-filter'"></i>
        </button>

        <!-- Settings toggle -->
        <button
          class="ctrl-btn"
          :class="{ active: showSettings }"
          title="Настройки"
          @click="toggleSettings"
          ref="settingsBtnRef"
        >
          <i class="pi pi-cog"></i>
        </button>

        <!-- Refresh -->
        <button class="ctrl-btn" title="Обновить" :class="{ loading }" @click="loadCards">
          <i :class="loading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"></i>
        </button>

        <!-- Search -->
        <input
          v-model="search"
          placeholder="Поиск..."
          class="cards-search"
        />
      </div>
    </div>

    <!-- Settings panel (dropdown) — teleported to body to avoid overflow clipping -->
    <Teleport to="body">
      <div
        v-if="showSettings"
        class="settings-overlay-global"
        @click.self="showSettings = false"
      >
        <div
          class="settings-dropdown-global"
          ref="settingsPanelRef"
          :style="settingsDropdownStyle"
        >
          <CardsSettingsPanel
            :model-value="settings"
            :fields="allFields"
            @update:modelValue="onSettingsChange"
          />
        </div>
      </div>
    </Teleport>

    <!-- Loading -->
    <div v-if="loading && !cards.length" class="cards-loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="cards-error">
      <i class="pi pi-exclamation-circle"></i>
      {{ error }}
    </div>

    <!-- KANBAN view (vertical grouping) -->
    <template v-else-if="settings.groupBy && settings.groupDirection === 'vertical'">
      <div class="kanban-board" @dragover.prevent>
        <CardKanbanColumn
          v-for="group in groupedCards"
          :key="group.value"
          :group-value="group.value"
          :group-label="group.label"
          :cards="group.cards"
          :card-size="settings.cardSize"
          :visible-field-ids="settings.visibleFields"
          :color="group.color"
          :show-image="settings.showImage !== false"
          :image-field="settings.imageField || null"
          @card-click="openEditDialog"
          @card-edit="openEditDialog"
          @card-dropped="onCardDropped"
          @card-reordered="onCardReordered"
          @card-inline-save="handleInlineSave($event.card, { fieldId: $event.fieldId, value: $event.value })"
        />
      </div>
    </template>

    <!-- HORIZONTAL grouping view -->
    <template v-else-if="settings.groupBy && settings.groupDirection === 'horizontal'">
      <div class="horizontal-groups">
        <div
          v-for="group in groupedCards"
          :key="group.value"
          class="horizontal-group"
        >
          <div
            class="group-header"
            :style="{ borderLeft: `3px solid ${group.color}` }"
            @click="toggleGroup(group.value)"
          >
            <i :class="collapsedGroups.has(group.value) ? 'pi pi-chevron-right' : 'pi pi-chevron-down'"></i>
            <span class="group-title">{{ group.value || '(Пусто)' }}</span>
            <span class="group-count">{{ group.cards.length }}</span>
          </div>
          <div v-if="!collapsedGroups.has(group.value)" class="group-cards" :style="gridStyle">
            <CardItem
              v-for="card in group.cards"
              :key="card.id"
              :card="card"
              :size="settings.cardSize"
              :visible-field-ids="settings.visibleFields"
              :stripe-color="group.color"
              :show-image="settings.showImage !== false"
              :image-field="settings.imageField || null"
              @click="openEditDialog(card)"
              @edit="openEditDialog(card)"
              @drop="onCardReordered"
              @inline-save="handleInlineSave(card, $event)"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- MASTER-DETAIL view (list mode, no grouping) -->
    <template v-else-if="settings.viewMode === 'list' && !settings.groupBy">
      <div v-if="displayedCards.length" class="master-detail-layout">
        <!-- Left panel: Master list -->
        <div class="master-panel" :style="{ width: masterPanelWidth + 'px' }">
          <div
            v-for="card in displayedCards"
            :key="card.id"
            class="master-row"
            :class="{ active: selectedRowId === card.id }"
            @click="selectRow(card)"
          >
            <span class="master-row-title">{{ card.title }}</span>
            <i class="pi pi-chevron-right master-row-chevron"></i>
          </div>
        </div>
        <!-- Right panel: Detail -->
        <div class="detail-panel">
          <Transition name="detail-fade" mode="out-in">
            <div v-if="selectedCard" :key="selectedCard.id" class="detail-panel-inner">
              <!-- Image (if image field exists) -->
              <div v-if="imageFieldValue(selectedCard)" class="detail-image-wrap">
                <img :src="imageFieldValue(selectedCard)" class="detail-image" alt="" />
              </div>
              <!-- Title (inline-editable) -->
              <div class="detail-panel-title-wrap">
                <div
                  v-if="detailEditingTitle !== selectedCard.id"
                  class="detail-panel-title"
                  @dblclick.stop="startDetailEditTitle(selectedCard)"
                >{{ selectedCard.title }}</div>
                <input
                  v-else
                  ref="detailTitleInputRef"
                  v-model="detailEditTitleValue"
                  class="detail-panel-title-input"
                  @blur="saveDetailTitle(selectedCard)"
                  @keydown.enter.prevent="saveDetailTitle(selectedCard)"
                  @keydown.escape.prevent="cancelDetailEditTitle"
                />
              </div>
              <!-- Fields (inline-editable) -->
              <div class="detail-panel-fields">
                <div v-for="f in visibleDetailFields(selectedCard)" :key="f.id" class="detail-panel-field">
                  <label>{{ f.name }}</label>
                  <div
                    v-if="detailEditingFieldId !== f.id || detailEditingCardId !== selectedCard.id"
                    class="detail-panel-value"
                    :class="{ memo: f.isLong }"
                    @dblclick.stop="startDetailEditField(selectedCard, f)"
                  >{{ f.value || '—' }}</div>
                  <textarea
                    v-else-if="f.isLong"
                    :ref="el => { if (el) detailFieldInputRefs[f.id] = el }"
                    v-model="detailEditFieldValue"
                    class="detail-panel-field-input detail-panel-field-textarea"
                    rows="3"
                    @blur="saveDetailField(selectedCard, f)"
                    @keydown.escape.prevent="cancelDetailEditField"
                  />
                  <input
                    v-else
                    :ref="el => { if (el) detailFieldInputRefs[f.id] = el }"
                    v-model="detailEditFieldValue"
                    class="detail-panel-field-input"
                    @blur="saveDetailField(selectedCard, f)"
                    @keydown.enter.prevent="saveDetailField(selectedCard, f)"
                    @keydown.escape.prevent="cancelDetailEditField"
                  />
                </div>
              </div>
              <!-- Actions -->
              <div class="detail-panel-actions">
                <button class="detail-panel-btn edit-btn" title="Редактировать" @click="openEditDialog(selectedCard)">
                  <i class="pi pi-pencil"></i> Редактировать
                </button>
                <button class="detail-panel-btn delete-btn" title="Удалить" @click="deleteCard(selectedCard)">
                  <i class="pi pi-trash"></i> Удалить
                </button>
              </div>
            </div>
            <div v-else key="empty" class="detail-panel-empty">
              <i class="pi pi-list"></i>
              <span>Выберите строку из списка</span>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Empty -->
      <div v-else class="cards-empty">
        <i class="pi pi-inbox"></i>
        <span>{{ search || hasActiveFilters ? 'Нет результатов' : 'Таблица пуста' }}</span>
      </div>
    </template>

    <!-- GRID / LIST view (no grouping) -->
    <template v-else>
      <div v-if="displayedCards.length" class="cards-grid" :style="gridStyle">
        <CardItem
          v-for="card in displayedCards"
          :key="card.id"
          :card="card"
          :size="settings.cardSize"
          :visible-field-ids="settings.visibleFields"
          :stripe-color="getColor(card.id)"
          :show-image="settings.showImage !== false"
          :image-field="settings.imageField || null"
          @click="openEditDialog(card)"
          @edit="openEditDialog(card)"
          @drop="onCardReordered"
          @inline-save="handleInlineSave(card, $event)"
        />
      </div>

      <!-- Empty -->
      <div v-else class="cards-empty">
        <i class="pi pi-inbox"></i>
        <span>{{ search || hasActiveFilters ? 'Нет результатов' : 'Таблица пуста' }}</span>
      </div>
    </template>

    <!-- Edit dialog -->
    <CardEditDialog
      v-model:visible="editDialogVisible"
      :card="editingCard"
      :database="database"
      :table-id="tableId"
      :cover-position="settings.coverPosition || 'center'"
      @saved="onCardSaved"
      @deleted="onCardDeleted"
    />

    <!-- Диалог серверной фильтрации (shared composable) -->
    <FilterConditionsDialog
      v-model:visible="serverFilters.isFilterDialogVisible.value"
      :filterConditions="serverFilters.filterConditions.value"
      :filterableFields="filterableFieldsNormalized"
      :refFilterOptions="serverFilters.refFilterOptions.value"
      :refFilterLoading="serverFilters.refFilterLoading.value"
      :currentUserId="integramApiClient.userId"
      :selectorState="selectorState"
      :loadRefOptions="serverFilters.loadRefOptions"
      @apply="onServerFilterApply"
      @reset="onServerFilterReset"
      @cancel="serverFilters.closeFilterDialog"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch, nextTick } from 'vue'
import integramApiClient from '@/services/integramApiClient'
import { updateBlock } from '@/services/docBlocksApiService'
import { selectorState, getGlobalSelector } from '@/stores/selectorState'
import { ensureKvalProxy } from '@/services/integramKvalProxyService'
import CardItem from './cards/CardItem.vue'
import CardKanbanColumn from './cards/CardKanbanColumn.vue'
import CardsSettingsPanel from './cards/CardsSettingsPanel.vue'
import CardEditDialog from './cards/CardEditDialog.vue'
import FilterConditionsDialog from './FilterConditionsDialog.vue'
import { useToast } from 'primevue/usetoast'
import { integramEventBus } from '@/services/integramEventBus'
import { useIntegramSync } from '@/composables/useIntegramSync'
import { useIntegramServerFilters, baseTypeStringToIntType } from '@/composables/useIntegramServerFilters'
// Issue #6742: Step 2 — WebSocket sync for cross-tab/cross-user propagation
const integramSync = useIntegramSync()

// ─── Серверная фильтрация ─────────────────────────────────────────────────────
const serverFilters = useIntegramServerFilters()

const props = defineProps({
  database: { type: String, required: true },
  tableId: { type: [String, Number], required: true },
  tableName: { type: String, default: '' },
  server: { type: String, default: 'https://ai2o.ru' },
  authToken: { type: String, default: '' },
  maxRows: { type: Number, default: 100 },
  // Settings persisted from blot data-value
  initialSettings: { type: Object, default: null },
  // Block ID for saving settings to DB metadata (shared across users)
  blockId: { type: [String, Number], default: null }
})

const emit = defineEmits(['settings-changed'])

const toast = useToast()

// ─── State ─────────────────────────────────────────────────────────────────────
const loading = ref(true)
const error = ref('')
const cards = ref([])
const allFields = ref([]) // [{ id, name, baseType }]
const search = ref('')
const openedCard = ref(null)
const showSettings = ref(false)
const editDialogVisible = ref(false)
const editingCard = ref(null)
const collapsedGroups = reactive(new Set())
const settingsBtnRef = ref(null)
const settingsPanelRef = ref(null)
const settingsDropdownStyle = ref({})

// ─── Master-Detail state ────────────────────────────────────────────────────────
const STORAGE_KEY_PREFIX = 'integram-cards-selected-'
const selectedRowId = ref(null)

// Master-Detail inline editing state
const detailTitleInputRef = ref(null)
const detailEditingTitle = ref(null) // card.id when editing title
const detailEditTitleValue = ref('')
const detailEditingCardId = ref(null) // card.id when editing a field
const detailEditingFieldId = ref(null) // field.id when editing a field
const detailEditFieldValue = ref('')
const detailFieldInputRefs = {}

function getStorageKey() {
  return `${STORAGE_KEY_PREFIX}${props.tableId}`
}

function saveSelectedRowId(id) {
  try { localStorage.setItem(getStorageKey(), String(id)) } catch {}
}

function loadSelectedRowId() {
  try { return localStorage.getItem(getStorageKey()) } catch { return null }
}

function selectRow(card) {
  selectedRowId.value = card.id
  saveSelectedRowId(card.id)
}

const selectedCard = computed(() => {
  if (!selectedRowId.value) return null
  return displayedCards.value.find(c => c.id === selectedRowId.value) || null
})

function startDetailEditTitle(card) {
  cancelDetailEditField()
  detailEditingTitle.value = card.id
  detailEditTitleValue.value = card.title || ''
  nextTick(() => {
    detailTitleInputRef.value?.focus()
    detailTitleInputRef.value?.select()
  })
}

async function saveDetailTitle(card) {
  if (detailEditingTitle.value !== card.id) return
  const newVal = detailEditTitleValue.value.trim()
  detailEditingTitle.value = null
  if (newVal === (card.title || '').trim()) return
  await handleInlineSave(card, { fieldId: null, value: newVal })
}

function cancelDetailEditTitle() {
  detailEditingTitle.value = null
  detailEditTitleValue.value = ''
}

function startDetailEditField(card, field) {
  cancelDetailEditTitle()
  detailEditingCardId.value = card.id
  detailEditingFieldId.value = field.id
  detailEditFieldValue.value = field.value || ''
  nextTick(() => {
    const el = detailFieldInputRefs[field.id]
    if (el) {
      el.focus()
      if (el.select) el.select()
    }
  })
}

async function saveDetailField(card, field) {
  if (detailEditingCardId.value !== card.id || detailEditingFieldId.value !== field.id) return
  const newVal = detailEditFieldValue.value
  detailEditingCardId.value = null
  detailEditingFieldId.value = null
  detailEditFieldValue.value = ''
  if (newVal === (field.value || '')) return
  await handleInlineSave(card, { fieldId: field.id, value: newVal })
}

function cancelDetailEditField() {
  detailEditingCardId.value = null
  detailEditingFieldId.value = null
  detailEditFieldValue.value = ''
}

// Image field detection — field whose value looks like a URL to an image
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i
const IMAGE_URL_PREFIX = /^https?:\/\//i

function imageFieldValue(card) {
  if (!card) return null
  for (const f of card.fields) {
    const val = f.value || ''
    if (val && IMAGE_URL_PREFIX.test(val) && IMAGE_EXTENSIONS.test(val)) {
      return val
    }
  }
  return null
}

function visibleDetailFields(card) {
  if (!card) return []
  const visible = settings.visibleFields
  if (!visible || !visible.length) return card.fields
  return card.fields.filter(f => visible.includes(f.id))
}

const masterPanelWidth = computed(() => settings.masterPanelWidth || 300)

// ─── Settings ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  cardSize: 'M',
  columns: 3,
  cardWidth: 260,
  viewMode: 'grid',
  groupBy: null,
  groupDirection: 'none',
  sortBy: null,
  sortDir: 'ASC',
  visibleFields: [],
  filters: [],
  filterLogic: 'AND',
  masterPanelWidth: 300,
  showImage: true,
  imageField: null,
  showEmptyColumns: true,
  coverPosition: 'center'
}

// ─── Group options (for kanban all-columns feature) ─────────────────────────────
const groupByOptions = ref([]) // [{ value, label }] — all possible group values

const settings = reactive({ ...DEFAULT_SETTINGS, ...(props.initialSettings || {}) })

// ─── Colors ────────────────────────────────────────────────────────────────────
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6']
function getColor(id) { return COLORS[parseInt(id) % COLORS.length] }
const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#0ea5e9', '#22c55e', '#f97316', '#eab308', '#14b8a6', '#ef4444', '#3b82f6']

// ─── Computed ──────────────────────────────────────────────────────────────────

const hasActiveFilters = computed(() =>
  settings.filters.some(f => {
    if (!f.fieldId || !f.op) return false
    if (f.valueSource === 'selector') return !!f.selectorName
    return true
  })
)

function applyFilter(card, filter) {
  // Resolve filter value: from selector or manual input
  let filterValue = filter.value || ''
  if (filter.valueSource === 'selector') {
    if (!filter.selectorName) return true // selector не задан — пропускаем все
    const resolved = getGlobalSelector(filter.selectorName)
    if (!resolved) return true // selector не выбран — пропускаем все
    filterValue = resolved
  }

  // Поддержка __val__ — фильтр по названию карточки (title)
  let val
  if (filter.fieldId === '__val__') {
    val = (card.title || '').toLowerCase()
  } else {
    // Нестрогое сравнение: f.id может быть числом, filter.fieldId — строкой (из <select>)
    const field = card.fields.find(f => String(f.id) === String(filter.fieldId))
    // Reference fields: field.value = objectId, field.displayLabel = text label.
    // Selector stores text labels → compare displayLabel for reference fields.
    val = ((field?.isReference ? (field?.displayLabel || field?.value) : field?.value) || '').toLowerCase()
  }

  const fval = filterValue.toLowerCase()
  switch (filter.op) {
    case 'eq': return val === fval
    case 'neq': return val !== fval
    case 'contains': return val.includes(fval)
    case 'notcontains': return !val.includes(fval)
    case 'gt': return parseFloat(val) > parseFloat(fval)
    case 'lt': return parseFloat(val) < parseFloat(fval)
    case 'empty': return !val
    case 'notempty': return !!val
    default: return true
  }
}

const filteredCards = computed(() => {
  // Track selectorState for reactivity — пересчитываем когда меняется любой selector
   
  const _selectors = selectorState.selectors

  let result = cards.value

  // Text search
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.fields.some(f => f.value?.toLowerCase().includes(q))
    )
  }

  // Panel filters
  const activeFilters = settings.filters.filter(f => f.fieldId && f.op)
  if (activeFilters.length) {
    result = result.filter(card => {
      if (settings.filterLogic === 'OR') {
        return activeFilters.some(f => applyFilter(card, f))
      }
      return activeFilters.every(f => applyFilter(card, f))
    })
  }

  return result
})

const sortedCards = computed(() => {
  if (!settings.sortBy) return filteredCards.value
  const fieldId = settings.sortBy
  const dir = settings.sortDir === 'DESC' ? -1 : 1
  return [...filteredCards.value].sort((a, b) => {
    const va = a.fields.find(f => f.id === fieldId)?.value || ''
    const vb = b.fields.find(f => f.id === fieldId)?.value || ''
    const na = parseFloat(va), nb = parseFloat(vb)
    if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir
    return va.localeCompare(vb, 'ru') * dir
  })
})

const displayedCards = computed(() => sortedCards.value)

const groupedCards = computed(() => {
  if (!settings.groupBy) return []
  const fieldId = settings.groupBy

  // Build a map from existing cards
  // Use String() comparison because f.id may be a number (from API) while
  // settings.groupBy is always a string (from localStorage/settings)
  const groupMap = new Map()
  // Also build a displayLabel fallback map: objectId → displayLabel from API response
  const displayLabelMap = new Map()
  for (const card of sortedCards.value) {
    const field = card.fields.find(f => String(f.id) === String(fieldId))
    const val = field?.value || ''
    if (!groupMap.has(val)) groupMap.set(val, [])
    groupMap.get(val).push(card)
    // Collect display labels from card data (available before groupByOptions loads)
    if (field?.displayLabel && val && !displayLabelMap.has(val)) {
      displayLabelMap.set(val, field.displayLabel)
    }
  }

  // Start with all known possible option values (if loaded)
  const knownValues = groupByOptions.value.length
    ? groupByOptions.value.map(o => o.value)
    : [...groupMap.keys()]

  // Build result: one entry per known value (in order)
  const result = knownValues.map((value, idx) => ({
    value,
    // Priority: groupByOptions label > displayLabel from card API data > raw value
    label: groupByOptions.value.find(o => o.value === value)?.label
      || displayLabelMap.get(value)
      || value
      || '(Пусто)',
    cards: groupMap.get(value) || [],
    color: GROUP_COLORS[idx % GROUP_COLORS.length]
  }))

  // Add any values from cards not in known options (excluding empty — handled separately)
  for (const [value, groupCards] of groupMap.entries()) {
    if (value !== '' && !knownValues.includes(value)) {
      result.push({
        value,
        label: groupByOptions.value.find(o => o.value === value)?.label
          || displayLabelMap.get(value)
          || value
          || '(Пусто)',
        cards: groupCards,
        color: GROUP_COLORS[result.length % GROUP_COLORS.length]
      })
    }
  }

  // Always add the empty column at the end (cards with no status set)
  result.push({
    value: '',
    label: '(Пусто)',
    cards: groupMap.get('') || [],
    color: GROUP_COLORS[result.length % GROUP_COLORS.length]
  })

  return result
})

const gridStyle = computed(() => ({
  '--card-cols': settings.columns === 'auto' ? 'auto-fill' : settings.columns,
  '--card-width': (settings.cardWidth || 260) + 'px'
}))

// ─── Нормализованные поля для серверной фильтрации ───────────────────────────
/**
 * Преобразует allFields в формат NormalizedField для composable useIntegramServerFilters.
 * apiKey = числовой ID реквизита (используется в F_{apiKey}=value)
 */
const filterableFieldsNormalized = computed(() =>
  allFields.value.map(f => ({
    id: String(f.id),
    label: f.name,
    type: baseTypeStringToIntType(f.baseType, f.isReference),
    columnType: f.isReference ? 'dir' : 'regular',
    dirTableId: f.dirTableId || null,
    apiKey: String(f.id)
  }))
)

/** Применить серверные фильтры из диалога и перезагрузить карточки */
async function onServerFilterApply(newConditions) {
  serverFilters.filterConditions.value = newConditions
  serverFilters.closeFilterDialog()
  await loadCards()
}

/** Сбросить все серверные фильтры и перезагрузить карточки */
async function onServerFilterReset() {
  serverFilters.filterConditions.value = []
  serverFilters.closeFilterDialog()
  await loadCards()
}

// ─── Data loading ──────────────────────────────────────────────────────────────
async function loadCards() {
  loading.value = true
  error.value = ''
  try {
    // Issue #6740: For kval database, ensure proxyPath is set on integramApiClient so
    // that buildURL() routes requests through the same-origin kval-proxy backend route
    // (e.g. /api/kval-proxy/edit_obj/…) instead of building a direct cross-origin URL
    // (e.g. /kval/edit_obj/…) that has no matching backend route and returns 404.
    if (props.database === 'kval') {
      await ensureKvalProxy()
    } else {
      // Ensure integramApiClient points to the correct database
      if (props.database && integramApiClient.database !== props.database) {
        integramApiClient.database = props.database
      }

      // Use provided auth token if available
      if (props.authToken && !integramApiClient.isAuthenticated()) {
        integramApiClient.setCredentials(props.database, props.authToken, null, props.database)
      } else if (!integramApiClient.isAuthenticated()) {
        integramApiClient.tryRestoreSession()
      }
    }

    // Добавить серверные фильтры из composable (если заданы)
    const queryParams = { LIMIT: props.maxRows }
    if (serverFilters.hasActiveFilters.value) {
      const sf = serverFilters.buildServerFilters(filterableFieldsNormalized.value, props.tableId)
      Object.assign(queryParams, sf)
    }

    const data = await integramApiClient.getObjectList(props.tableId, queryParams)

    const reqOrder = data.req_order || []
    const reqTypes = data.req_type || {}
    const reqBase = data.req_base || {}
    const refType = data.ref_type || {}
    const reqs = data.reqs || {}
    const objects = data.object || []

    // Build fields list
    allFields.value = reqOrder
      .filter(rid => reqTypes[rid])
      .map(rid => ({
        id: rid,
        name: reqTypes[rid],
        baseType: reqBase[rid] || 'SHORT',
        // ref_type map: { reqId: referencedTypeId } — marks reference fields
        isReference: !!refType[rid],
        // dirTableId нужен для серверной фильтрации по справочным полям
        dirTableId: refType[rid] ? String(refType[rid]) : null
      }))

    cards.value = objects.map(obj => ({
      id: obj.id,
      title: obj.val || `#${obj.id}`,
      fields: allFields.value.map(f => {
        // For reference fields: getObjectList returns reqs[objId][reqId] = display label
        // AND reqs[objId]['ref_' + reqId] = 'typeId:objectId' (raw reference).
        // We need the reference OBJECT ID for groupBy grouping and for _m_set saving.
        // Extract it from 'ref_{reqId}' which has format 'typeId:objectId'.
        let value = reqs[obj.id]?.[f.id] || ''
        let displayLabel = value  // display label from API (before overwriting with objectId)
        if (f.isReference) {
          const rawRef = reqs[obj.id]?.['ref_' + f.id]
          if (rawRef && typeof rawRef === 'string') {
            // Format: 'typeId:objectId' — take the last colon-separated segment as objectId
            const parts = rawRef.split(':')
            value = parts[parts.length - 1] || ''
          }
        }
        return {
          id: f.id,
          name: f.name,
          value,
          displayLabel,  // human-readable label from API, used before groupByOptions loads
          isLong: f.baseType === 'MEMO',
          baseType: f.baseType,
          isReference: f.isReference
        }
      })
    }))

    // If groupByOptions already loaded (race: options finished before cards), normalize now
    if (settings.groupBy && groupByOptions.value.length > 0) {
      const normFieldId = settings.groupBy
      for (const card of cards.value) {
        const field = card.fields.find(f => String(f.id) === String(normFieldId))
        if (!field || !field.value) continue
        const isKnownId = groupByOptions.value.some(o => o.value === String(field.value))
        if (!isKnownId) {
          const byLabel = groupByOptions.value.find(o => o.label === field.value)
          if (byLabel) {
            field.displayLabel = field.value
            field.value = byLabel.value
          }
        }
      }
    }

    // Restore or set selected row for master-detail
    const savedId = loadSelectedRowId()
    const ids = cards.value.map(c => c.id)
    if (savedId && ids.includes(savedId)) {
      selectedRowId.value = savedId
    } else if (cards.value.length) {
      selectedRowId.value = cards.value[0].id
    }
  } catch (e) {
    error.value = `Ошибка загрузки: ${e.message}`
  } finally {
    loading.value = false
  }
}

// ─── Group options loader ───────────────────────────────────────────────────────
async function loadGroupByOptions(fieldId) {
  if (!fieldId) {
    groupByOptions.value = []
    return
  }
  try {
    const refData = await integramApiClient.getReferenceOptions(fieldId, 0)
    if (refData && typeof refData === 'object') {
      // getReferenceOptions returns { id: label } or { id: { val } } pairs
      groupByOptions.value = Object.entries(refData).map(([id, label]) => ({
        // value = reference object ID (used for groupBy grouping and _m_set saving)
        value: String(id),
        label: typeof label === 'object' ? (label.val || String(id)) : String(label)
      }))
      // After loading options, normalize card field values that may be display labels
      // (when API didn't return ref_ data, loadCards stored display label as field.value)
      for (const card of cards.value) {
        const field = card.fields.find(f => String(f.id) === String(fieldId))
        if (!field || !field.value) continue
        const isKnownId = groupByOptions.value.some(o => o.value === String(field.value))
        if (!isKnownId) {
          const byLabel = groupByOptions.value.find(o => o.label === field.value)
          if (byLabel) {
            field.displayLabel = field.value  // keep original as displayLabel
            field.value = byLabel.value       // normalize to objectId
          }
        }
      }
    } else {
      groupByOptions.value = []
    }
  } catch {
    // Fallback: options will be derived from existing card values in groupedCards computed
    groupByOptions.value = []
  }
}

// ─── Card interactions ─────────────────────────────────────────────────────────
function openCard(card) {
  openedCard.value = card
}

function openEditDialog(card) {
  editingCard.value = card
  editDialogVisible.value = true
  openedCard.value = null
}

function onCardSaved({ cardId, values, title }) {
  // Update local card data without full reload.
  // Object.entries() yields fieldId as a string, but field.id from the API may be
  // a number — use loose equality (==) to match regardless of type.
  const card = cards.value.find(c => c.id === cardId)
  if (card) {
    if (title) card.title = title
    for (const [fieldId, val] of Object.entries(values)) {
       
      const field = card.fields.find(f => f.id == fieldId)
      if (field) field.value = val
    }
  }
}

function onCardDeleted(cardId) {
  cards.value = cards.value.filter(c => c.id !== cardId)
  // If deleted card was selected in master-detail, clear selection
  if (selectedRowId.value === cardId) {
    selectedRowId.value = null
    try { localStorage.removeItem(getStorageKey()) } catch {}
  }
}

// ─── Inline save ───────────────────────────────────────────────────────────────
async function handleInlineSave(card, { fieldId, value }) {
  const originalCard = cards.value.find(c => c.id === card.id)
  if (!originalCard) return

  // Store original values for rollback on error
  const originalTitle = originalCard.title
  const originalField = fieldId ? originalCard.fields.find(f => f.id === fieldId) : null
  const originalFieldValue = originalField ? originalField.value : null

  // Optimistically update local state
  if (fieldId === null) {
    originalCard.title = value
  } else if (originalField) {
    originalField.value = value
  }

  try {
    // Issue #6744: Ensure proxyPath is set for kval before saving
    if (props.database === 'kval') {
      await ensureKvalProxy()
    }
    if (fieldId === null) {
      // Save the main object title (val)
      await integramApiClient.saveObject(card.id, props.tableId, value)
    } else {
      // Save a specific requisite field
      await integramApiClient.setObjectRequisites(card.id, { [fieldId]: value })
    }
    // Notify other components on this page about the update
    const inlineRequisites = fieldId === null ? {} : { [fieldId]: value }
    // For the groupBy reference field, include displayLabels so DataTable can update cell.value
    let inlineDisplayLabels
    if (fieldId !== null && String(fieldId) === String(settings.groupBy) && groupByOptions.value.length > 0) {
      const opt = groupByOptions.value.find(o => o.value === String(value) || o.label === String(value))
      if (opt) {
        inlineRequisites[fieldId] = opt.value   // always objectId
        inlineDisplayLabels = { [fieldId]: opt.label }
      }
    }
    integramEventBus.emit('object:updated', {
      database: props.database,
      typeId: String(props.tableId),
      objectId: card.id,
      requisites: inlineRequisites,
      displayLabels: inlineDisplayLabels
    })
    // Issue #6742: Broadcast to other tabs/users via WebSocket
    integramSync.publish('object:updated', { database: props.database, typeId: String(props.tableId), objectId: card.id, requisites: inlineRequisites })
    toast.add({ severity: 'success', summary: 'Сохранено', life: 1500 })
  } catch (e) {
    // Rollback on error
    if (fieldId === null) {
      originalCard.title = originalTitle
    } else if (originalField) {
      originalField.value = originalFieldValue
    }
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', detail: e.message, life: 3000 })
  }
}

async function deleteCard(card) {
  if (!confirm(`Удалить «${card.title}»?`)) return
  try {
    // Issue #6744: Ensure proxyPath is set for kval before deleting
    if (props.database === 'kval') {
      await ensureKvalProxy()
    }
    await integramApiClient.deleteObject(card.id)
    onCardDeleted(card.id)
    // Notify other components on this page about the deletion
    integramEventBus.emit('object:deleted', {
      database: props.database,
      typeId: String(props.tableId),
      objectId: card.id
    })
    // Issue #6742: Broadcast to other tabs/users via WebSocket
    integramSync.publish('object:deleted', { database: props.database, typeId: String(props.tableId), objectId: card.id })
  } catch (e) {
    alert(`Ошибка удаления: ${e.message}`)
  }
}

// ─── Drag & Drop ───────────────────────────────────────────────────────────────
async function onCardDropped({ cardId, targetGroupValue }) {
  // Change group field value when dropped to different kanban column
  if (!settings.groupBy) return
  const card = cards.value.find(c => c.id === cardId)
  if (!card) return

  // Support both card.fields (array) and card.reqs (object) formats
  // Use String() comparison because f.id may be a number (from API) while
  // settings.groupBy is always a string (from localStorage/settings)
  let field = null
  if (Array.isArray(card.fields)) {
    field = card.fields.find(f => String(f.id) === String(settings.groupBy))
  }
  if (!field && card.reqs && typeof card.reqs === 'object') {
    const req = card.reqs[settings.groupBy]
    if (req !== undefined) {
      field = { id: settings.groupBy, value: req?.value ?? req }
    }
  }
  if (!field) return

  try {
    // Issue #6744: Ensure proxyPath is set for kval before saving
    if (props.database === 'kval') {
      await ensureKvalProxy()
    }
    await integramApiClient.setObjectRequisites(cardId, { [settings.groupBy]: targetGroupValue })
    // Find display label for the new group value (so DataTableWrapper can update cell.value)
    const groupLabel = groupByOptions.value.find(o => o.value === String(targetGroupValue))?.label
    // Notify other components on this page about the update
    integramEventBus.emit('object:updated', {
      database: props.database,
      typeId: String(props.tableId),
      objectId: cardId,
      requisites: { [settings.groupBy]: targetGroupValue },
      displayLabels: groupLabel !== undefined ? { [settings.groupBy]: groupLabel } : undefined
    })
    // Issue #6742: Broadcast to other tabs/users via WebSocket
    integramSync.publish('object:updated', { database: props.database, typeId: String(props.tableId), objectId: cardId, requisites: { [settings.groupBy]: targetGroupValue } })
    // Update local state to trigger reactivity
    if (Array.isArray(card.fields)) {
      const f = card.fields.find(f => String(f.id) === String(settings.groupBy))
      if (f) f.value = targetGroupValue
    }
    if (card.reqs && typeof card.reqs === 'object' && card.reqs[settings.groupBy] !== undefined) {
      const req = card.reqs[settings.groupBy]
      if (req && typeof req === 'object') req.value = targetGroupValue
      else card.reqs[settings.groupBy] = targetGroupValue
    }
  } catch (e) {
    console.error('Failed to update card group:', e)
    // Rollback local state and notify user on API failure
    if (Array.isArray(card.fields)) {
      const f = card.fields.find(f => String(f.id) === String(settings.groupBy))
      if (f) f.value = field.value
    }
    if (card.reqs && typeof card.reqs === 'object' && card.reqs[settings.groupBy] !== undefined) {
      const req = card.reqs[settings.groupBy]
      if (req && typeof req === 'object') req.value = field.value
      else card.reqs[settings.groupBy] = field.value
    }
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', detail: e.message, life: 3000 })
  }
}

async function onCardReordered({ draggedCardId, targetCardId, groupValue }) {
  // Reorder within same list
  const arr = cards.value
  const fromIdx = arr.findIndex(c => String(c.id) === String(draggedCardId))
  const toIdx = arr.findIndex(c => String(c.id) === String(targetCardId))
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return

  const item = arr.splice(fromIdx, 1)[0]
  arr.splice(toIdx, 0, item)

  // If groupValue is provided and differs from the card's current group, save to DB
  if (groupValue !== undefined && settings.groupBy) {
    const card = item
    let currentGroupValue = null
    if (Array.isArray(card.fields)) {
      const f = card.fields.find(f => String(f.id) === String(settings.groupBy))
      if (f) currentGroupValue = f.value
    } else if (card.reqs && typeof card.reqs === 'object') {
      const req = card.reqs[settings.groupBy]
      currentGroupValue = req && typeof req === 'object' ? req.value : req
    }
    if (String(currentGroupValue) !== String(groupValue)) {
      // Card moved to a different column — save the new group to DB
      try {
        // Issue #6744: Ensure proxyPath is set for kval before saving
        if (props.database === 'kval') {
          await ensureKvalProxy()
        }
        await integramApiClient.setObjectRequisites(card.id, { [settings.groupBy]: groupValue })
        // Update local state
        if (Array.isArray(card.fields)) {
          const f = card.fields.find(f => String(f.id) === String(settings.groupBy))
          if (f) f.value = groupValue
        }
        if (card.reqs && typeof card.reqs === 'object' && card.reqs[settings.groupBy] !== undefined) {
          const req = card.reqs[settings.groupBy]
          if (req && typeof req === 'object') req.value = groupValue
          else card.reqs[settings.groupBy] = groupValue
        }
      } catch (e) {
        console.error('Failed to update card group on reorder:', e)
        toast.add({ severity: 'error', summary: 'Ошибка сохранения', detail: e.message, life: 3000 })
      }
    }
  }
}

// ─── Settings ──────────────────────────────────────────────────────────────────
function switchHeaderMode(mode) {
  if (mode === 'kanban') {
    settings.groupDirection = 'vertical'
    if (!settings.groupBy && allFields.value.length > 0) {
      settings.groupBy = String(allFields.value[0].id)
      loadGroupByOptions(settings.groupBy)
    }
  } else {
    settings.viewMode = mode
    // Полностью выходим из канбана — сбрасываем и groupDirection и groupBy
    if (settings.groupDirection === 'vertical') {
      settings.groupDirection = 'none'
      settings.groupBy = null
    }
  }
  saveSettings()
}

function toggleSettings(e) {
  if (!showSettings.value && settingsBtnRef.value) {
    const rect = settingsBtnRef.value.getBoundingClientRect()
    const panelWidth = 320
    // rect.right is already in viewport coords (fixed positioning)
    const leftPos = Math.max(8, rect.right - panelWidth)
    const availableBelow = window.innerHeight - rect.bottom - 14

    if (availableBelow < 200) {
      // Not enough space below — open panel upward
      settingsDropdownStyle.value = {
        position: 'fixed',
        bottom: `${window.innerHeight - rect.top + 6}px`,
        left: `${leftPos}px`,
        maxHeight: `${Math.max(100, rect.top - 14)}px`,
        zIndex: 9999
      }
    } else {
      settingsDropdownStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 6}px`,
        left: `${leftPos}px`,
        maxHeight: `${availableBelow}px`,
        zIndex: 9999
      }
    }
  }
  showSettings.value = !showSettings.value
  e.stopPropagation()
}

function onSettingsChange(newSettings) {
  Object.assign(settings, newSettings)
  saveSettings()
}

function saveSettings() {
  const cardSettings = {
    cardSize: settings.cardSize,
    columns: settings.columns,
    cardWidth: settings.cardWidth,
    viewMode: settings.viewMode,
    groupBy: settings.groupBy,
    groupDirection: settings.groupDirection,
    sortBy: settings.sortBy,
    sortDir: settings.sortDir,
    visibleFields: settings.visibleFields,
    filters: settings.filters,
    filterLogic: settings.filterLogic,
    masterPanelWidth: settings.masterPanelWidth,
    showImage: settings.showImage,
    imageField: settings.imageField,
    showEmptyColumns: settings.showEmptyColumns,
    coverPosition: settings.coverPosition
  }

  // Emit to parent for blot data-value update
  emit('settings-changed', cardSettings)

  // Save to DB metadata if blockId available (shared across all users)
  if (props.blockId) {
    updateBlock(String(props.blockId), { metadata: { cardSettings } }, 'kval').catch(e => {
      console.error('[CardsEmbed] Ошибка сохранения настроек в DB:', e)
    })
  }
}

function toggleGroup(val) {
  if (collapsedGroups.has(val)) {
    collapsedGroups.delete(val)
  } else {
    collapsedGroups.add(val)
  }
}

// Close settings on outside click
function onDocClick(e) {
  if (showSettings.value && settingsPanelRef.value && !settingsPanelRef.value.contains(e.target)) {
    showSettings.value = false
  }
}

// ─── EventBus: sync updates from other components on the same page ─────────────
function onBusObjectUpdated({ database, typeId, objectId, requisites, displayLabels }) {
  if (database !== props.database) return
  if (String(typeId) !== String(props.tableId)) return
  const card = cards.value.find(c => c.id === objectId)
  if (!card) return
  const groupByFieldId = settings.groupBy
  for (const [fieldId, val] of Object.entries(requisites)) {
    const field = card.fields.find(f => String(f.id) === String(fieldId))
    if (!field) continue
    // For the groupBy reference field, normalize value to objectId to avoid duplicate columns
    if (String(fieldId) === String(groupByFieldId) && groupByOptions.value.length > 0) {
      const strVal = String(val)
      const isObjectId = groupByOptions.value.some(o => String(o.value) === strVal)
      if (isObjectId) {
        field.value = strVal
      } else {
        // val is a display label — find matching objectId
        const byLabel = groupByOptions.value.find(o => o.label === strVal)
        field.value = byLabel ? String(byLabel.value) : strVal
      }
    } else {
      field.value = val
    }
    // Update display label if provided
    if (displayLabels?.[fieldId] !== undefined) {
      field.label = displayLabels[fieldId]
    }
  }
}

function onBusObjectDeleted({ database, typeId, objectId }) {
  if (database !== props.database) return
  if (String(typeId) !== String(props.tableId)) return
  onCardDeleted(objectId)
}

function onBusObjectCreated({ database, typeId }) {
  if (database !== props.database) return
  if (String(typeId) !== String(props.tableId)) return
  // Reload to pick up the new object
  loadCards()
}

onMounted(() => {
  loadCards()
  document.addEventListener('click', onDocClick)
  if (settings.groupBy) loadGroupByOptions(settings.groupBy)
  integramEventBus.on('object:updated', onBusObjectUpdated)
  integramEventBus.on('object:deleted', onBusObjectDeleted)
  integramEventBus.on('object:created', onBusObjectCreated)
  // Issue #6742: Subscribe to WS sync channel for this table
  integramSync.subscribe([{ database: props.database, typeId: String(props.tableId) }])
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  // Issue #6740: Clear proxy mode so other components use their own URL builder
  if (props.database === 'kval' && integramApiClient.proxyPath) {
    integramApiClient.proxyPath = null
  }
  integramEventBus.off('object:updated', onBusObjectUpdated)
  integramEventBus.off('object:deleted', onBusObjectDeleted)
  integramEventBus.off('object:created', onBusObjectCreated)
})

// Watch for prop changes to reload
watch(() => [props.database, props.tableId], loadCards)

// Reload group options when groupBy field changes
watch(() => settings.groupBy, (newFieldId) => {
  loadGroupByOptions(newFieldId)
})
</script>

<style scoped>
.integram-cards-embed {
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 10px;
  background: var(--p-content-background, #fff);
  overflow: visible;
  font-family: 'Inter', system-ui, sans-serif;
  position: relative;
}

/* ── Header ─────────────────────────────────────────────────────── */
.cards-embed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--p-content-background, #f8fafc);
  border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
  gap: 10px;
  flex-wrap: wrap;
}

.cards-embed-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: 13px;
  color: var(--p-text-color, #1e293b);
}

.cards-count {
  background: var(--p-content-border-color, #e2e8f0);
  color: var(--p-text-muted-color, #475569);
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 600;
}

.filter-badge {
  color: var(--p-primary-color, #6366f1);
  font-size: 12px;
}

.cards-embed-controls {
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
  flex-shrink: 0;
}

.ctrl-btn.active {
  background: var(--p-primary-color, #6366f1);
  color: white;
  border-color: var(--p-primary-color, #6366f1);
}

.ctrl-btn:hover:not(.active) {
  background: var(--p-content-hover-background, #f1f5f9);
}

.ctrl-btn.loading {
  pointer-events: none;
  opacity: 0.6;
}

.cards-search {
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 12px;
  outline: none;
  width: 140px;
  color: var(--p-text-color, #334155);
  background: var(--p-content-background, white);
}

.cards-search:focus {
  border-color: var(--p-primary-color, #6366f1);
}

/* ── Settings panel ─────────────────────────────────────────────── */
/* Overlay and dropdown are teleported to body — global styles below */

/* ── Loading / error / empty ──────────────────────────────────────── */
.cards-loading,
.cards-error,
.cards-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 13px;
}

.cards-error {
  color: var(--p-red-500, #ef4444);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--p-content-border-color, #e2e8f0);
  border-top-color: var(--p-primary-color, #6366f1);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Cards grid ──────────────────────────────────────────────────── */
/* Issue #6805: Fixed height = 20 standard rows (720px) for content area */
.cards-grid {
  padding: 12px;
  display: grid;
  gap: 10px;
  height: 720px;
  max-height: 720px;
  overflow-y: auto;
}

/* Fixed-width columns via CSS variables set inline */
.cards-grid {
  grid-template-columns: repeat(var(--card-cols, 3), var(--card-width, 260px));
  justify-content: center;
}

/* ── Kanban board ────────────────────────────────────────────────── */
/* Issue #6805: Fixed height = 720px for kanban content area */
.kanban-board {
  display: flex;
  gap: 12px;
  padding: 12px;
  overflow-x: auto;
  height: 720px;
  max-height: 720px;
  overflow-y: auto;
  align-items: flex-start;
}

/* ── Horizontal groups ───────────────────────────────────────────── */
/* Issue #6805: Fixed height = 720px for horizontal groups content area */
.horizontal-groups {
  display: flex;
  flex-direction: column;
  height: 720px;
  max-height: 720px;
  overflow-y: auto;
}

.horizontal-group {
  border-bottom: 1px solid var(--p-content-hover-background, #f1f5f9);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--p-content-background, #f8fafc);
  user-select: none;
}

.group-header:hover {
  background: var(--p-content-hover-background, #f1f5f9);
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  flex: 1;
}

.group-count {
  background: var(--p-content-border-color, #e2e8f0);
  color: var(--p-text-muted-color, #64748b);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
}

.group-cards {
  padding: 10px 14px;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(var(--card-cols, 3), var(--card-width, 260px));
  justify-content: center;
}

/* ── Master-Detail layout ────────────────────────────────────────── */
/* Issue #6805: Fixed height = 720px for master-detail content area */
.master-detail-layout {
  display: flex;
  height: 720px;
  overflow: hidden;
}

.master-panel {
  flex-shrink: 0;
  border-right: 1px solid var(--p-content-border-color, #e2e8f0);
  overflow-y: auto;
  background: var(--p-content-background, #f8fafc);
}

.master-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--p-content-hover-background, #f1f5f9);
  gap: 8px;
  transition: background 0.12s;
}

.master-row:hover:not(.active) {
  background: var(--p-content-hover-background, #f1f5f9);
}

.master-row.active {
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 10%, transparent);
  border-left: 3px solid var(--p-primary-color, #6366f1);
  padding-left: 9px;
}

.master-row-title {
  font-size: 13px;
  color: var(--p-text-color, #1e293b);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-row.active .master-row-title {
  color: var(--p-primary-color, #6366f1);
  font-weight: 600;
}

.master-row-chevron {
  font-size: 10px;
  color: var(--p-text-muted-color, #94a3b8);
  flex-shrink: 0;
}

.master-row.active .master-row-chevron {
  color: var(--p-primary-color, #6366f1);
}

.detail-panel {
  flex: 1;
  overflow-y: auto;
  background: var(--p-content-background, white);
  min-width: 0;
}

.detail-panel-inner {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 13px;
  padding: 32px;
}

/* Image */
.detail-image-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--p-content-hover-background, #f1f5f9);
}

.detail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Title */
.detail-panel-title-wrap {
  min-height: 24px;
}

.detail-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  cursor: text;
}

.detail-panel-title-input {
  font-size: 15px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  background: var(--p-content-background, white);
  border: 1px solid var(--p-primary-color, #6366f1);
  border-radius: 5px;
  padding: 3px 8px;
  width: 100%;
  outline: none;
  font-family: inherit;
}

/* Fields */
.detail-panel-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-panel-field label {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  display: block;
  margin-bottom: 2px;
}

.detail-panel-value {
  font-size: 13px;
  color: var(--p-text-color, #334155);
  background: var(--p-content-background, #f8fafc);
  padding: 6px 10px;
  border-radius: 5px;
  line-height: 1.5;
  cursor: text;
}

.detail-panel-value.memo {
  white-space: pre-wrap;
  font-size: 12px;
}

.detail-panel-field-input {
  font-size: 13px;
  color: var(--p-text-color, #334155);
  background: var(--p-content-background, white);
  border: 1px solid var(--p-primary-color, #6366f1);
  border-radius: 5px;
  padding: 5px 10px;
  width: 100%;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.detail-panel-field-textarea {
  resize: vertical;
  min-height: 60px;
}

/* Actions */
.detail-panel-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.detail-panel-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  background: var(--p-content-background, white);
  cursor: pointer;
  font-size: 12px;
  color: var(--p-text-muted-color, #475569);
  transition: all 0.15s;
}

.detail-panel-btn:hover {
  background: var(--p-content-hover-background, #f1f5f9);
}

.edit-btn:hover {
  color: var(--p-primary-color, #6366f1);
  border-color: var(--p-primary-color, #6366f1);
}

.delete-btn:hover {
  color: var(--p-red-500, #ef4444);
  border-color: var(--p-red-500, #ef4444);
  background: var(--p-red-50, #fff5f5);
}

/* Fade transition */
.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.15s ease;
}
.detail-fade-enter-from,
.detail-fade-leave-to {
  opacity: 0;
}

/* Responsive: mobile */
@media (max-width: 600px) {
  .master-detail-layout {
    flex-direction: column;
    height: auto;
  }

  .master-panel {
    width: 100% !important;
    max-height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
  }

  .detail-panel {
    min-height: 300px;
  }
}

/* =====================================================
   DARK THEME OVERRIDES
   Fixes elements that appear too bright on dark theme
   ===================================================== */

.app-dark .integram-cards-embed {
  border-color: var(--p-surface-600, #475569);
  background: var(--p-surface-900, #0f172a);
}

.app-dark .cards-embed-header {
  background: var(--p-surface-800, #1e293b);
  border-bottom-color: var(--p-surface-600, #475569);
}

.app-dark .ctrl-btn {
  border-color: var(--p-surface-600, #475569);
  background: var(--p-surface-800, #1e293b);
}

.app-dark .ctrl-btn:hover:not(.active) {
  background: var(--p-surface-700, #334155);
}

.app-dark .cards-search {
  border-color: var(--p-surface-600, #475569);
  background: var(--p-surface-800, #1e293b);
  color: var(--p-surface-100, #f1f5f9);
}

.app-dark .horizontal-group {
  border-bottom-color: var(--p-surface-700, #334155);
}

.app-dark .group-header {
  background: var(--p-surface-800, #1e293b);
}

.app-dark .group-header:hover {
  background: var(--p-surface-700, #334155);
}

.app-dark .master-panel {
  background: var(--p-surface-800, #1e293b);
  border-right-color: var(--p-surface-600, #475569);
}

.app-dark .master-row {
  border-bottom-color: var(--p-surface-700, #334155);
}

.app-dark .master-row:hover:not(.active) {
  background: var(--p-surface-700, #334155);
}

.app-dark .detail-panel {
  background: var(--p-surface-900, #0f172a);
}

.app-dark .detail-image-wrap {
  background: var(--p-surface-700, #334155);
}

.app-dark .detail-panel-value {
  background: var(--p-surface-800, #1e293b);
}

.app-dark .detail-panel-title-input {
  background: var(--p-surface-800, #1e293b);
}

.app-dark .detail-panel-field-input,
.app-dark .detail-panel-field-textarea {
  background: var(--p-surface-800, #1e293b);
  color: var(--p-surface-100, #f1f5f9);
}

.app-dark .detail-panel-btn {
  border-color: var(--p-surface-600, #475569);
  background: var(--p-surface-800, #1e293b);
}

.app-dark .detail-panel-btn:hover {
  background: var(--p-surface-700, #334155);
}

.app-dark .delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* ── Card detail overlay ─────────────────────────────────────────── */
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.card-detail {
  background: var(--p-content-background, white);
  border-radius: 10px;
  width: 90%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.app-dark .card-detail {
  background: var(--p-surface-900, #0f172a);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--p-content-hover-background, #f1f5f9);
}

.app-dark .detail-header {
  border-bottom-color: var(--p-surface-700, #334155);
}

.detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  flex: 1;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-action-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  background: var(--p-content-background, white);
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  color: var(--p-text-muted-color, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-action-btn:hover {
  background: var(--p-content-hover-background, #f1f5f9);
  color: var(--p-primary-color, #6366f1);
}

.app-dark .detail-action-btn {
  border-color: var(--p-surface-600, #475569);
  background: var(--p-surface-800, #1e293b);
}

.app-dark .detail-action-btn:hover {
  background: var(--p-surface-700, #334155);
}

.detail-close {
  width: 26px;
  height: 26px;
  border: none;
  background: var(--p-content-hover-background, #f1f5f9);
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  color: var(--p-text-muted-color, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-dark .detail-close {
  background: var(--p-surface-700, #334155);
}

.detail-fields {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-field label {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  display: block;
  margin-bottom: 2px;
}

.detail-value {
  font-size: 13px;
  color: var(--p-text-color, #334155);
  background: var(--p-content-background, #f8fafc);
  padding: 6px 10px;
  border-radius: 5px;
  line-height: 1.5;
}

.detail-value.memo {
  white-space: pre-wrap;
  font-size: 12px;
}

.app-dark .detail-value {
  background: var(--p-surface-800, #1e293b);
}
</style>

<!-- Global styles for teleported settings dropdown (not scoped) -->
<style>
.settings-overlay-global {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: transparent;
}

.settings-dropdown-global {
  position: fixed;
  z-index: 9999;
  overflow-y: auto;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
</style>

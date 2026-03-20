<template>
  <div class="settings-panel" @click.stop>
    <!-- Section: View -->
    <div class="settings-section">
      <div class="section-title">Вид</div>

      <!-- Show image toggle -->
      <div class="setting-row">
        <label>Показывать изображение</label>
        <label class="toggle-switch">
          <input
            type="checkbox"
            :checked="modelValue.showImage !== false"
            @change="update('showImage', $event.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Image field selector (only when showImage is on) -->
      <div v-if="modelValue.showImage !== false" class="setting-row">
        <label>Поле изображения</label>
        <select class="setting-select" :value="modelValue.imageField || ''" @change="update('imageField', $event.target.value || null)">
          <option value="">— Авто —</option>
          <option v-for="f in fields" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </div>

      <!-- Any URL as image (only when showImage is on) -->
      <div v-if="modelValue.showImage !== false" class="setting-row">
        <label class="field-toggle">
          <input
            type="checkbox"
            :checked="modelValue.anyUrlAsImage === true"
            @change="update('anyUrlAsImage', $event.target.checked)"
          />
          Любой URL как изображение
        </label>
      </div>

      <!-- Cover image position (only when showImage is on) -->
      <div v-if="modelValue.showImage !== false" class="setting-row">
        <label>Позиция обложки</label>
        <div class="btn-group">
          <button
            :class="['mode-btn', { active: (modelValue.coverPosition || 'center') === 'top' }]"
            :title="'Верх'"
            @click="update('coverPosition', 'top')"
          >↑</button>
          <button
            :class="['mode-btn', { active: (modelValue.coverPosition || 'center') === 'center' }]"
            :title="'Центр'"
            @click="update('coverPosition', 'center')"
          >✦</button>
          <button
            :class="['mode-btn', { active: (modelValue.coverPosition || 'center') === 'bottom' }]"
            :title="'Низ'"
            @click="update('coverPosition', 'bottom')"
          >↓</button>
        </div>
      </div>

      <!-- Card size -->
      <div class="setting-row">
        <label>Размер карточки</label>
        <div class="btn-group">
          <button
            v-for="sz in ['S', 'M', 'L']"
            :key="sz"
            :class="['size-btn', { active: modelValue.cardSize === sz }]"
            @click="update('cardSize', sz)"
          >{{ sz }}</button>
        </div>
      </div>

      <!-- View mode -->
      <div class="setting-row">
        <label>Режим</label>
        <div class="btn-group">
          <button
            :class="['mode-btn', { active: modelValue.viewMode === 'grid' && modelValue.groupDirection !== 'vertical' }]"
            @click="switchViewMode('grid')"
          ><i class="pi pi-th-large"></i> Сетка</button>
          <button
            :class="['mode-btn', { active: modelValue.viewMode === 'list' && modelValue.groupDirection !== 'vertical' }]"
            @click="switchViewMode('list')"
          ><i class="pi pi-list"></i> Список</button>
          <button
            :class="['mode-btn', { active: modelValue.groupDirection === 'vertical' }]"
            @click="setKanbanMode()"
          ><i class="pi pi-table"></i> Kanban</button>
        </div>
      </div>

      <!-- Columns count (only in grid mode) -->
      <div v-if="modelValue.viewMode !== 'list'" class="setting-row">
        <label>Колонки</label>
        <div class="btn-group">
          <button
            v-for="n in [1,2,3,4,5,6]"
            :key="n"
            :class="['col-btn', { active: modelValue.columns === n }]"
            @click="update('columns', n)"
          >{{ n }}</button>
        </div>
      </div>

      <!-- Card width slider (only in grid mode) -->
      <div v-if="modelValue.viewMode !== 'list'" class="setting-row">
        <label>Ширина карточки</label>
        <div class="slider-wrap">
          <input
            type="range"
            min="160"
            max="400"
            step="10"
            class="panel-width-slider"
            :value="modelValue.cardWidth || 260"
            @input="update('cardWidth', Number($event.target.value))"
          />
          <span class="slider-value">{{ modelValue.cardWidth || 260 }}px</span>
        </div>
      </div>

      <!-- Left panel width (only in list mode) -->
      <div v-if="modelValue.viewMode === 'list'" class="setting-row">
        <label>Ширина списка</label>
        <div class="slider-wrap">
          <input
            type="range"
            min="200"
            max="400"
            step="10"
            class="panel-width-slider"
            :value="modelValue.masterPanelWidth || 300"
            @input="update('masterPanelWidth', Number($event.target.value))"
          />
          <span class="slider-value">{{ modelValue.masterPanelWidth || 300 }}px</span>
        </div>
      </div>
    </div>

    <!-- Section: Grouping -->
    <div class="settings-section">
      <div class="section-title">Группировка</div>
      <div class="setting-row">
        <label>Поле</label>
        <select class="setting-select" :value="modelValue.groupBy" @change="update('groupBy', $event.target.value || null)">
          <option value="">— Нет —</option>
          <option v-for="f in fields" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </div>
      <div v-if="modelValue.groupBy" class="setting-row">
        <label>Направление</label>
        <div class="btn-group">
          <button
            :class="['mode-btn', { active: modelValue.groupDirection === 'vertical' }]"
            @click="update('groupDirection', 'vertical')"
          >Kanban</button>
          <button
            :class="['mode-btn', { active: modelValue.groupDirection === 'horizontal' }]"
            @click="update('groupDirection', 'horizontal')"
          >Строки</button>
        </div>
      </div>
      <div v-if="modelValue.groupBy && modelValue.groupDirection === 'vertical'" class="setting-row">
        <label>Пустые колонки</label>
        <label class="toggle-switch">
          <input
            type="checkbox"
            :checked="modelValue.showEmptyColumns !== false"
            @change="update('showEmptyColumns', $event.target.checked)"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Section: Sorting -->
    <div class="settings-section">
      <div class="section-title">Сортировка</div>
      <div class="setting-row">
        <label>Поле</label>
        <select class="setting-select" :value="modelValue.sortBy" @change="update('sortBy', $event.target.value || null)">
          <option value="">— Нет —</option>
          <option v-for="f in fields" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </div>
      <div v-if="modelValue.sortBy" class="setting-row">
        <label>Порядок</label>
        <div class="btn-group">
          <button :class="['mode-btn', { active: modelValue.sortDir === 'ASC' }]" @click="update('sortDir', 'ASC')">↑ По возр.</button>
          <button :class="['mode-btn', { active: modelValue.sortDir === 'DESC' }]" @click="update('sortDir', 'DESC')">↓ По убыв.</button>
        </div>
      </div>
    </div>

    <!-- Section: Fields visibility -->
    <div class="settings-section">
      <div class="section-title">Поля на карточке</div>
      <div class="fields-list">
        <label
          v-for="f in fields"
          :key="f.id"
          class="field-toggle"
        >
          <input
            type="checkbox"
            :checked="isFieldVisible(f.id)"
            @change="toggleField(f.id)"
          />
          {{ f.name }}
        </label>
      </div>
    </div>

    <!-- Section: Filters -->
    <div class="settings-section">
      <div class="section-title">
        Фильтры
        <button class="add-filter-btn" @click="addFilter">+ Добавить</button>
      </div>
      <div v-for="(filter, idx) in modelValue.filters" :key="idx" class="filter-row">
        <select class="filter-select" :value="filter.fieldId" @change="updateFilter(idx, 'fieldId', $event.target.value)">
          <option value="">Поле...</option>
          <option value="__val__">Название (заголовок)</option>
          <option v-for="f in fields" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
        <select class="filter-select filter-op" :value="filter.op" @change="updateFilter(idx, 'op', $event.target.value)">
          <option value="eq">=</option>
          <option value="neq">≠</option>
          <option value="contains">содержит</option>
          <option value="notcontains">не содержит</option>
          <option value="gt">&gt;</option>
          <option value="lt">&lt;</option>
          <option value="empty">пусто</option>
          <option value="notempty">не пусто</option>
        </select>
        <!-- Value source toggle (only when op requires a value) -->
        <template v-if="!['empty', 'notempty'].includes(filter.op)">
          <div class="filter-source-toggle">
            <button
              :class="['src-btn', { active: !filter.valueSource || filter.valueSource === 'manual' }]"
              title="Ввести вручную"
              @click="updateFilter(idx, 'valueSource', 'manual')"
            >Вручную</button>
            <button
              :class="['src-btn', { active: filter.valueSource === 'selector' }]"
              title="Использовать Selector-блок"
              @click="switchToSelectorMode(idx)"
            >Selector</button>
          </div>
          <!-- Manual value input -->
          <input
            v-if="!filter.valueSource || filter.valueSource === 'manual'"
            type="text"
            class="filter-value-input"
            :value="filter.value"
            placeholder="Значение..."
            @input="updateFilter(idx, 'value', $event.target.value)"
          />
          <!-- Selector name dropdown (auto-detects selectors on the page) -->
          <select
            v-else
            class="filter-value-input filter-selector-name"
            :value="filter.selectorName || ''"
            @change="updateFilter(idx, 'selectorName', $event.target.value || null)"
          >
            <option value="">Выберите Selector...</option>
            <option v-for="name in availableSelectors" :key="name" :value="name">{{ name }}</option>
            <!-- Fallback: allow manual entry if auto-detection missed something -->
            <option
              v-if="filter.selectorName && !availableSelectors.includes(filter.selectorName)"
              :value="filter.selectorName"
            >{{ filter.selectorName }}</option>
          </select>
        </template>
        <button class="remove-filter-btn" @click="removeFilter(idx)">✕</button>
      </div>
      <div v-if="(modelValue.filters?.length ?? 0) > 1" class="filter-logic-row">
        <label>Логика:</label>
        <div class="btn-group">
          <button :class="['mode-btn', { active: modelValue.filterLogic === 'AND' }]" @click="update('filterLogic', 'AND')">И (AND)</button>
          <button :class="['mode-btn', { active: modelValue.filterLogic === 'OR' }]" @click="update('filterLogic', 'OR')">ИЛИ (OR)</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
    // { cardSize, columns, viewMode, groupBy, groupDirection, sortBy, sortDir, visibleFields, filters, filterLogic }
  },
  fields: {
    type: Array,
    default: () => [] // [{ id, name }]
  }
})

const emit = defineEmits(['update:modelValue'])

// Detect available Selector blocks on the page from DOM
const availableSelectors = computed(() => {
  try {
    return Array.from(document.querySelectorAll('.selector-embed[data-name]'))
      .map(el => el.getAttribute('data-name'))
      .filter(Boolean)
  } catch { return [] }
})

function update(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function switchViewMode(mode) {
  const updates = { ...props.modelValue, viewMode: mode }
  // Exit kanban: reset groupDirection so the grid/list template branch is shown
  if (updates.groupDirection === 'vertical') {
    updates.groupDirection = 'horizontal'
  }
  emit('update:modelValue', updates)
}

function setKanbanMode() {
  const updates = { ...props.modelValue, groupDirection: 'vertical' }
  // Auto-select the first available field if groupBy is not set, so Kanban mode is immediately visible
  if (!updates.groupBy && props.fields.length > 0) {
    updates.groupBy = props.fields[0].id
  }
  emit('update:modelValue', updates)
}

function isFieldVisible(fieldId) {
  if (!props.modelValue.visibleFields || !props.modelValue.visibleFields.length) return true
  return props.modelValue.visibleFields.includes(fieldId)
}

function toggleField(fieldId) {
  let visible = props.modelValue.visibleFields ? [...props.modelValue.visibleFields] : []
  if (!visible.length) {
    // Initialize with all fields except toggled one
    visible = props.fields.map(f => f.id).filter(id => id !== fieldId)
  } else if (visible.includes(fieldId)) {
    visible = visible.filter(id => id !== fieldId)
  } else {
    visible.push(fieldId)
  }
  update('visibleFields', visible)
}

function addFilter() {
  const filters = [...(props.modelValue.filters || []), { fieldId: '', op: 'contains', value: '', valueSource: 'manual', selectorName: null }]
  update('filters', filters)
}

function updateFilter(idx, key, value) {
  const filters = [...(props.modelValue.filters || [])]
  filters[idx] = { ...filters[idx], [key]: value }
  update('filters', filters)
}

// Switch filter to "selector" mode and auto-fill selectorName if only one is available
function switchToSelectorMode(idx) {
  const filters = [...(props.modelValue.filters || [])]
  const current = filters[idx]
  const autoName = (!current.selectorName && availableSelectors.value.length === 1)
    ? availableSelectors.value[0]
    : (current.selectorName || null)
  filters[idx] = { ...current, valueSource: 'selector', selectorName: autoName }
  update('filters', filters)
}

function removeFilter(idx) {
  const filters = [...(props.modelValue.filters || [])]
  filters.splice(idx, 1)
  update('filters', filters)
}
</script>

<style scoped>
.settings-panel {
  background: var(--p-content-background, white);
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 10px;
  padding: 14px;
  width: 320px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 13px;
  color: var(--p-text-color, #1e293b);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--p-content-hover-background, #f1f5f9);
}

.settings-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--p-text-muted-color, #64748b);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-row label {
  font-size: 12px;
  color: var(--p-text-muted-color, #475569);
  min-width: 80px;
  flex-shrink: 0;
}

.btn-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.size-btn,
.col-btn,
.mode-btn {
  padding: 4px 10px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 5px;
  background: var(--p-content-background, white);
  cursor: pointer;
  font-size: 12px;
  color: var(--p-text-muted-color, #475569);
  transition: all 0.12s;
  white-space: nowrap;
}

.size-btn.active,
.col-btn.active,
.mode-btn.active {
  background: var(--p-primary-color, #6366f1);
  color: white;
  border-color: var(--p-primary-color, #6366f1);
}

.size-btn:hover:not(.active),
.col-btn:hover:not(.active),
.mode-btn:hover:not(.active) {
  background: var(--p-content-background, #f8fafc);
  border-color: color-mix(in srgb, var(--p-primary-color, #6366f1) 40%, transparent);
}

.setting-select {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 5px;
  font-size: 12px;
  color: var(--p-text-color, #334155);
  background: var(--p-content-background, white);
  outline: none;
}

.setting-select:focus {
  border-color: var(--p-primary-color, #6366f1);
}

/* Fields list */
.fields-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.field-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 0;
}

.field-toggle input[type="checkbox"] {
  cursor: pointer;
}

/* Filters */
.add-filter-btn {
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--p-primary-color, #6366f1) 40%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 10%, transparent);
  color: var(--p-primary-color, #6366f1);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.add-filter-btn:hover {
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 20%, transparent);
}

.filter-row {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-select {
  padding: 4px 6px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 4px;
  font-size: 11px;
  color: var(--p-text-color, #334155);
  background: var(--p-content-background, white);
  outline: none;
  min-width: 0;
  flex: 1;
}

.filter-select.filter-op {
  flex: 0 0 90px;
}

.filter-value-input {
  flex: 1;
  padding: 4px 6px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 4px;
  font-size: 11px;
  color: var(--p-text-color, #334155);
  outline: none;
  min-width: 0;
}

.filter-value-input:focus,
.filter-select:focus {
  border-color: var(--p-primary-color, #6366f1);
}

.filter-source-toggle {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.src-btn {
  padding: 3px 7px;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 4px;
  background: var(--p-content-background, white);
  cursor: pointer;
  font-size: 10px;
  color: var(--p-text-muted-color, #475569);
  white-space: nowrap;
  transition: all 0.12s;
}

.src-btn.active {
  background: var(--p-primary-color, #6366f1);
  color: white;
  border-color: var(--p-primary-color, #6366f1);
}

.src-btn:hover:not(.active) {
  border-color: color-mix(in srgb, var(--p-primary-color, #6366f1) 40%, transparent);
}

.filter-selector-name {
  font-style: italic;
}

.remove-filter-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: var(--p-red-50, #fee2e2);
  color: var(--p-red-500, #ef4444);
  border-radius: 50%;
  cursor: pointer;
  font-size: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-logic-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.filter-logic-row label {
  font-size: 11px;
  color: var(--p-text-muted-color, #64748b);
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--p-surface-300, #cbd5e1);
  border-radius: 20px;
  transition: background 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 3px;
  top: 3px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--p-primary-500, #6366f1);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(14px);
}

/* Panel width slider */
.slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.panel-width-slider {
  flex: 1;
  accent-color: var(--p-primary-color, #6366f1);
  cursor: pointer;
}

.slider-value {
  font-size: 11px;
  color: var(--p-text-muted-color, #475569);
  min-width: 36px;
  text-align: right;
}
</style>

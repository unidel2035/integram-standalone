<template>
  <Dialog
    :visible="visible"
    header="Настройки колонки"
    :style="{ width: '680px' }"
    :modal="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="select-column-config">
      <!-- Multi-select toggle -->
      <div class="field mb-4 multi-toggle-row">
        <label class="font-semibold text-sm">
          <i class="pi pi-list mr-2"></i>Тип выбора
        </label>
        <div class="toggle-group mt-2">
          <Button
            :label="localConfig.isMulti ? 'Множественный выбор' : 'Одиночный выбор'"
            :icon="localConfig.isMulti ? 'pi pi-check-square' : 'pi pi-stop'"
            :severity="localConfig.isMulti ? 'primary' : 'secondary'"
            size="small"
            @click="localConfig.isMulti = !localConfig.isMulti"
          />
          <small class="text-color-secondary ml-2">
            {{ localConfig.isMulti ? 'Можно выбрать несколько значений' : 'Одно значение из справочника' }}
          </small>
        </div>
      </div>

      <TabView>
        <!-- Tab 1: Display Field -->
        <TabPanel header="Отображение">
          <div class="field mb-4">
            <label class="block mb-2 font-semibold text-sm">
              <i class="pi pi-eye mr-2"></i>Поле для отображения
            </label>
            <Dropdown
              v-model="localConfig.displayField"
              :options="displayFieldOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Выберите поле из справочника"
              class="w-full"
              showClear
            />
            <small class="text-color-secondary mt-1 block">
              Какое поле справочника показывать в ячейке. По умолчанию: первое поле (VAL)
            </small>
          </div>

          <!-- Preview -->
          <div v-if="directoryPreview && directoryPreview.length > 0" class="preview-section mt-4 p-3">
            <div class="preview-label mb-2">
              <i class="pi pi-eye"></i>
              <span>Предпросмотр (первые 3 записи):</span>
            </div>
            <div class="preview-items">
              <div
                v-for="(item, idx) in directoryPreview.slice(0, 3)"
                :key="idx"
                class="preview-item"
              >
                <span class="preview-id">{{ item.id }}:</span>
                <span class="preview-value">{{ getPreviewValue(item) }}</span>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Tab 2: Filter Builder -->
        <TabPanel header="Фильтр">
          <div class="filter-builder">
            <!-- Empty state -->
            <div v-if="localConfig.filterConditions.length === 0" class="filter-empty">
              <i class="pi pi-filter text-color-secondary" style="font-size: 1.5rem"></i>
              <p class="text-color-secondary text-sm mt-2">
                Нет условий фильтрации. Добавьте условие, чтобы ограничить список выбора.
              </p>
            </div>

            <!-- Condition rows -->
            <div
              v-for="(cond, idx) in localConfig.filterConditions"
              :key="cond.id"
              class="filter-condition-block"
            >
              <!-- AND / OR connector between rows -->
              <div v-if="idx > 0" class="filter-logic-row">
                <Button
                  label="И"
                  size="small"
                  :severity="localConfig.filterLogic === 'AND' ? 'primary' : 'secondary'"
                  @click="localConfig.filterLogic = 'AND'"
                />
                <Button
                  label="ИЛИ"
                  size="small"
                  :severity="localConfig.filterLogic === 'OR' ? 'primary' : 'secondary'"
                  @click="localConfig.filterLogic = 'OR'"
                  class="ml-1"
                />
              </div>

              <!-- Condition row: Field | Operator | ValueType | Value | Remove -->
              <div class="filter-row">
                <!-- Field from related table -->
                <Dropdown
                  v-model="cond.field"
                  :options="filterFieldOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Поле справочника"
                  class="filter-field-select"
                />

                <!-- Operator -->
                <Dropdown
                  v-model="cond.operator"
                  :options="operatorOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="filter-operator-select"
                />

                <!-- Value type: literal or dynamic (from current row) -->
                <Dropdown
                  v-model="cond.valueType"
                  :options="valueTypeOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="filter-type-select"
                  @change="() => { cond.value = ''; cond.dynamicField = null }"
                />

                <!-- Literal value: dropdown if reference field, text input otherwise -->
                <template v-if="cond.valueType === 'literal'">
                  <Dropdown
                    v-if="getRefItems(cond.field).length > 0"
                    v-model="cond.value"
                    :options="getRefItems(cond.field)"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Выберите значение"
                    class="filter-value-input"
                    showClear
                    filter
                  />
                  <InputText
                    v-else
                    v-model="cond.value"
                    placeholder="Введите значение"
                    class="filter-value-input"
                  />
                </template>
                <!-- Dynamic: pick field from current table row -->
                <Dropdown
                  v-else
                  v-model="cond.dynamicField"
                  :options="currentFieldOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Поле строки"
                  class="filter-value-input"
                  showClear
                />

                <!-- Remove condition -->
                <Button
                  icon="pi pi-times"
                  severity="danger"
                  text
                  size="small"
                  class="filter-remove-btn"
                  @click="removeCondition(idx)"
                />
              </div>
            </div>

            <!-- Add condition button -->
            <Button
              label="Добавить условие"
              icon="pi pi-plus"
              text
              size="small"
              class="mt-3"
              @click="addCondition"
            />
          </div>

          <!-- Info message when conditions are set -->
          <Message v-if="localConfig.filterConditions.length > 0" severity="info" :closable="false" class="mt-3">
            <template #default>
              <div class="text-sm">
                <strong>Сгенерированный фильтр:</strong>
                <code class="filter-preview-code">{{ generatedFilterCondition }}</code>
              </div>
            </template>
          </Message>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <Button label="Отмена" icon="pi pi-times" @click="$emit('cancel')" text />
      <Button
        label="Сохранить"
        icon="pi pi-save"
        @click="saveConfig"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Message from 'primevue/message'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    default: () => ({})
  },
  header: {
    type: Object,
    default: () => ({})
  },
  directoryFields: {
    type: Array,
    default: () => []
  },
  directoryPreview: {
    type: Array,
    default: () => []
  },
  currentTableFields: {
    type: Array,
    default: () => []
  },
  isMulti: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'save', 'cancel'])

// ─── Local state ────────────────────────────────────────────────────────────

const localConfig = ref({
  displayField: null,
  filterConditions: [],
  filterLogic: 'AND',
  isMulti: false
})

// ─── Filter options ──────────────────────────────────────────────────────────

const operatorOptions = [
  { label: '=', value: '=' },
  { label: '≠', value: '<>' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '≥', value: '>=' },
  { label: '≤', value: '<=' }
]

const valueTypeOptions = [
  { label: 'Значение', value: 'literal' },
  { label: 'Поле строки', value: 'dynamic' }
]

// Fields from the related (directory) table
const filterFieldOptions = computed(() => {
  if (!props.directoryFields || props.directoryFields.length === 0) {
    return [{ label: 'VAL (Главное значение)', value: 'val' }]
  }

  const options = [{ label: 'VAL (Главное значение)', value: 'val' }]
  props.directoryFields.forEach(field => {
    const label = field.alias || field.val || field.value || `Поле ${field.id}`
    options.push({ label, value: String(field.id) })
  })
  return options
})

// Fields from the current table row (for dynamic filters like [cur.termId])
const currentFieldOptions = computed(() => {
  if (!props.currentTableFields || props.currentTableFields.length === 0) return []

  return props.currentTableFields
    .filter(h => h.termId || (h.id && h.id.startsWith('req_')))
    .map(h => {
      const label = h.value || h.alias || `Поле ${h.termId || h.id}`
      const termId = String(h.termId || h.id.replace('req_', ''))
      return { label, value: termId }
    })
})

// Display field options (for the Display tab)
const displayFieldOptions = computed(() => {
  if (!props.directoryFields || props.directoryFields.length === 0) {
    return [{ label: 'VAL (Главное значение)', value: 'val' }]
  }

  const options = [{ label: 'VAL (Главное значение)', value: 'val' }]
  props.directoryFields.forEach(field => {
    if (field.alias || field.val || field.value) {
      const label = field.alias || field.val || field.value || `Поле ${field.id}`
      options.push({ label, value: String(field.id) })
    }
  })
  return options
})

// Preview of the generated filter string (shown in info message)
const generatedFilterCondition = computed(() => buildFilterCondition(
  localConfig.value.filterConditions,
  localConfig.value.filterLogic
))

// Get reference items for a field (when the field is a reference/справочник type)
// Returns [{label, value}] for the dropdown, or [] if not a reference field
function getRefItems(fieldId) {
  if (!fieldId || !props.directoryFields) return []
  const field = props.directoryFields.find(f => String(f.id) === String(fieldId))
  if (!field?.refItems?.length) return []
  return field.refItems.map(item => ({
    label: item.value || item.id,
    value: item.value   // compare by display name (VAL) — matches ref.val in evaluateFilterCondition
  }))
}

// ─── Condition management ────────────────────────────────────────────────────

function makeCondition() {
  return {
    id: Date.now() + Math.random(),
    field: null,
    operator: '=',
    valueType: 'literal',
    value: '',
    dynamicField: null
  }
}

function addCondition() {
  localConfig.value.filterConditions.push(makeCondition())
}

function removeCondition(idx) {
  localConfig.value.filterConditions.splice(idx, 1)
}

// ─── Filter string ↔ conditions conversion ──────────────────────────────────

function buildFilterCondition(conditions, logic) {
  const parts = (conditions || [])
    .filter(c => c.field && (c.valueType === 'literal' ? c.value?.trim() : c.dynamicField))
    .map(c => {
      const fieldRef = `[${c.field}]`
      const valueRef = c.valueType === 'dynamic' && c.dynamicField
        ? `[cur.${c.dynamicField}]`
        : `'${c.value}'`
      return `${fieldRef} ${c.operator} ${valueRef}`
    })
  return parts.join(` ${logic || 'AND'} `)
}

function parseFilterCondition(condition) {
  if (!condition?.trim()) return { conditions: [], logic: 'AND' }

  const logic = / OR /i.test(condition) ? 'OR' : 'AND'
  const separator = logic === 'OR' ? / OR /i : / AND /i
  const parts = condition.split(separator)

  const conditions = []
  for (const part of parts) {
    // Match: [fieldId] OP 'value'  OR  [fieldId] OP [cur.termId]
    const m = part.trim().match(/^\[([^\]]+)\]\s*(=|<>|>=|<=|>|<)\s*(.+)$/)
    if (!m) continue

    const [, fieldId, operator, rawValue] = m
    const isDynamic = /^\[cur\./.test(rawValue)

    conditions.push({
      id: Date.now() + Math.random(),
      field: fieldId,
      operator,
      valueType: isDynamic ? 'dynamic' : 'literal',
      value: isDynamic ? '' : rawValue.replace(/^'|'$/g, ''),
      dynamicField: isDynamic ? rawValue.replace(/^\[cur\.(.+)\]$/, '$1') : null
    })
  }

  return { conditions, logic }
}

// ─── Preview value for Display tab ──────────────────────────────────────────

function getPreviewValue(item) {
  if (!localConfig.value.displayField || localConfig.value.displayField === 'val') {
    return item.val || item.value || '—'
  }
  const fieldId = localConfig.value.displayField
  if (item.reqs && item.reqs[fieldId]) {
    return item.reqs[fieldId].value || item.reqs[fieldId] || '—'
  }
  return item.val || item.value || '—'
}

// ─── Save ────────────────────────────────────────────────────────────────────

function saveConfig() {
  const filterCondition = buildFilterCondition(
    localConfig.value.filterConditions,
    localConfig.value.filterLogic
  )
  emit('save', {
    displayField: localConfig.value.displayField,
    filterCondition,
    isMulti: localConfig.value.isMulti
  })
}

// ─── Watchers ────────────────────────────────────────────────────────────────

function syncFromConfig(config, isMulti) {
  const { conditions, logic } = parseFilterCondition(config?.filterCondition || '')
  localConfig.value = {
    displayField: config?.displayField || null,
    filterConditions: conditions,
    filterLogic: logic,
    isMulti: isMulti ?? false
  }
}

watch(() => props.config, (newConfig) => {
  syncFromConfig(newConfig, props.isMulti)
}, { immediate: true, deep: true })

watch(() => props.isMulti, (val) => {
  localConfig.value.isMulti = val
})

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    syncFromConfig(props.config, props.isMulti)
  }
})
</script>

<style scoped>
.select-column-config {
  display: flex;
  flex-direction: column;
}

.field {
  display: flex;
  flex-direction: column;
}

.multi-toggle-row {
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 1rem;
}

.toggle-group {
  display: flex;
  align-items: center;
}

/* ── Filter builder ── */
.filter-builder {
  display: flex;
  flex-direction: column;
}

.filter-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  color: var(--p-text-muted-color);
}

.filter-condition-block {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.5rem;
}

.filter-logic-row {
  display: flex;
  align-items: center;
  padding: 0.25rem 0;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
}

.filter-field-select {
  flex: 2;
  min-width: 0;
}

.filter-operator-select {
  flex: 0 0 70px;
}

.filter-type-select {
  flex: 0 0 110px;
}

.filter-value-input {
  flex: 2;
  min-width: 0;
}

.filter-remove-btn {
  flex: 0 0 auto;
}

.filter-preview-code {
  display: block;
  margin-top: 0.4rem;
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.82em;
  word-break: break-all;
}

/* ── Preview section ── */
.preview-section {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
}

.preview-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.preview-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  padding: 0.5rem;
  background: var(--p-surface-100);
  border-radius: 4px;
}

.preview-id {
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  color: var(--p-text-muted-color);
  font-weight: 500;
}

.preview-value {
  color: var(--p-text-color);
}

code {
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  background: var(--p-surface-100);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85em;
}
</style>

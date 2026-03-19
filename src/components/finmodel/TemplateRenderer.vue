<template>
  <div class="tr-root">
    <!-- Sheet tabs -->
    <SelectButton
      v-if="template.sheets && template.sheets.length > 1"
      v-model="activeSheet"
      :options="sheetOptions"
      optionLabel="label"
      optionValue="value"
      :allowEmpty="false"
      class="tr-sheet-tabs"
    />

    <!-- Active sheet panels -->
    <div v-if="currentSheet" class="tr-sheet">
      <div
        v-for="(panel, pi) in currentSheet.panels"
        :key="pi"
        class="tr-panel"
      >
        <div class="tr-panel-header" @click="togglePanel(pi)">
          <i :class="['pi', collapsedPanels[pi] ? 'pi-chevron-right' : 'pi-chevron-down']" />
          <span>{{ panel.name }}</span>
        </div>

        <table v-show="!collapsedPanels[pi]" class="tr-table">
          <thead>
            <tr>
              <th class="tr-col-name">Показатель</th>
              <th class="tr-col-value">Значение</th>
              <th class="tr-col-mu">Ед.</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in panel.items"
              :key="item.name"
              :class="{ 'tr-row-total': item.level === 0, 'tr-row-formula': item.type === 'formula' }"
            >
              <td class="tr-col-name" :style="{ paddingLeft: (item.level || 0) * 16 + 8 + 'px' }">
                {{ item.name }}
              </td>
              <td class="tr-col-value">
                <InputNumber
                  v-if="item.type === 'input'"
                  :modelValue="values[item.name]"
                  @update:modelValue="onInputChange(item.name, $event)"
                  :showButtons="false"
                  :minFractionDigits="0"
                  :maxFractionDigits="2"
                  fluid
                  class="tr-input"
                />
                <span v-else class="tr-formula-val" :class="{ 'tr-negative': (values[item.name] || 0) < 0 }">
                  {{ formatValue(values[item.name], item.mu) }}
                </span>
              </td>
              <td class="tr-col-mu">{{ item.mu }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'

const props = defineProps({
  template: { type: Object, required: true },
  defaults: { type: Object, default: null }
})

const emit = defineEmits(['values-changed'])

const activeSheet = ref(0)
const collapsedPanels = reactive({})
const values = reactive({})

const sheetOptions = computed(() =>
  (props.template.sheets || []).map((s, i) => ({ label: s.name, value: i }))
)

const currentSheet = computed(() => props.template.sheets?.[activeSheet.value] || null)

// Collect all items across all sheets for cross-sheet formula resolution
const allItems = computed(() => {
  const items = []
  if (!props.template.sheets) return items
  for (const sheet of props.template.sheets) {
    for (const panel of sheet.panels) {
      for (const item of panel.items) {
        items.push(item)
      }
    }
  }
  return items
})

function initValues() {
  for (const item of allItems.value) {
    if (item.type === 'input') {
      values[item.name] = props.defaults?.[item.name] ?? item.default ?? 0
    }
  }
  recalcAll()
}

function onInputChange(name, val) {
  values[name] = typeof val === 'number' ? val : 0
  recalcAll()
  emit('values-changed', { ...values })
}

function recalcAll() {
  for (const item of allItems.value) {
    if (item.type === 'formula' && item.formula) {
      values[item.name] = evaluateFormula(item.formula)
    }
  }
}

function evaluateFormula(formula) {
  if (!formula) return 0
  try {
    // Replace [ItemName] references with their values
    let expr = formula.replace(/\[([^\]]+)\]/g, (_, name) => {
      const val = values[name]
      return typeof val === 'number' && !isNaN(val) ? val : 0
    })

    // Handle MAX(a,b), MIN(a,b), IF(cond,a,b), ABS(a)
    expr = expr.replace(/MAX\(([^,]+),([^)]+)\)/gi, (_, a, b) => `Math.max(${a},${b})`)
    expr = expr.replace(/MIN\(([^,]+),([^)]+)\)/gi, (_, a, b) => `Math.min(${a},${b})`)
    expr = expr.replace(/ABS\(([^)]+)\)/gi, (_, a) => `Math.abs(${a})`)
    expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, a, b) => `((${cond}) ? (${a}) : (${b}))`)

    const fn = new Function(`"use strict"; return (${expr})`)
    const result = fn()
    return typeof result === 'number' && isFinite(result) ? result : 0
  } catch {
    return 0
  }
}

function formatValue(val, mu) {
  if (val === undefined || val === null || isNaN(val)) return '—'
  // Values in template are already in display units (%, x, тыс.руб.)
  if (mu === 'x') return val.toFixed(2) + 'x'
  if (mu === '%') return val.toFixed(1) + '%'
  if (Math.abs(val) >= 1000) return val.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
  if (Number.isInteger(val)) return val.toString()
  return val.toFixed(2)
}

function togglePanel(pi) {
  collapsedPanels[pi] = !collapsedPanels[pi]
}

watch(() => props.template, () => {
  activeSheet.value = 0
  Object.keys(collapsedPanels).forEach(k => delete collapsedPanels[k])
  Object.keys(values).forEach(k => delete values[k])
  initValues()
}, { deep: false })

watch(() => props.defaults, (newDefaults) => {
  if (!newDefaults) return
  for (const [name, val] of Object.entries(newDefaults)) {
    if (values[name] !== undefined) values[name] = val
  }
  recalcAll()
  emit('values-changed', { ...values })
}, { deep: true })

onMounted(() => {
  initValues()
})
</script>

<style scoped>
.tr-root {
  color: var(--p-text-color);
  max-width: 100%;
  overflow-x: auto;
}

.tr-sheet-tabs {
  margin-bottom: 14px;
}

.tr-sheet {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tr-panel {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--p-surface-card);
}

.tr-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--p-surface-card);
  color: var(--p-text-color);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  user-select: none;
  border-bottom: 1px solid var(--p-content-border-color);
}
.tr-panel-header:hover {
  opacity: 0.85;
}
.tr-panel-header i {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.tr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  table-layout: fixed;
}

.tr-table thead th {
  padding: 6px 10px;
  text-align: left;
  font-weight: 600;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tr-table td {
  padding: 5px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent);
  color: var(--p-text-color);
}
.tr-table tr:last-child td {
  border-bottom: none;
}

.tr-col-name { width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-col-value { width: 35%; text-align: right; }
.tr-col-mu { width: 15%; text-align: right; color: var(--p-text-muted-color); font-size: 10px; }

.tr-table thead th.tr-col-value { text-align: right; }
.tr-table thead th.tr-col-mu { text-align: right; }

.tr-row-total td {
  font-weight: 700;
  background: color-mix(in srgb, var(--p-surface-card) 60%, transparent);
}

.tr-input {
  max-width: 130px;
  float: right;
}
.tr-input :deep(.p-inputnumber-input) {
  text-align: right;
  font-size: 12px;
  padding: 4px 8px;
}

.tr-formula-val {
  display: block;
  text-align: right;
}
.tr-negative {
  color: var(--fst-red);
}
</style>

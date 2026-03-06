<template>
  <div class="template-renderer">
    <!-- Sheet tabs -->
    <div v-if="template.sheets && template.sheets.length > 1" class="sheet-tabs">
      <button
        v-for="(sheet, si) in template.sheets"
        :key="si"
        :class="['sheet-tab', { active: activeSheet === si }]"
        @click="activeSheet = si"
      >
        {{ sheet.name }}
      </button>
    </div>

    <!-- Active sheet panels -->
    <div v-if="currentSheet" class="sheet-content">
      <div
        v-for="(panel, pi) in currentSheet.panels"
        :key="pi"
        class="panel"
      >
        <div
          class="panel-header"
          @click="togglePanel(pi)"
        >
          <i :class="['pi', collapsedPanels[pi] ? 'pi-chevron-right' : 'pi-chevron-down']" />
          <span>{{ panel.name }}</span>
        </div>

        <table v-show="!collapsedPanels[pi]" class="items-table">
          <thead>
            <tr>
              <th class="col-name">Показатель</th>
              <th class="col-value">Значение</th>
              <th class="col-mu">Ед.</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in panel.items"
              :key="item.name"
              :class="{ 'row-formula': item.type === 'formula', 'row-level0': item.level === 0 }"
            >
              <td class="col-name" :style="{ paddingLeft: (item.level || 0) * 16 + 8 + 'px' }">
                {{ item.name }}
              </td>
              <td class="col-value">
                <input
                  v-if="item.type === 'input'"
                  type="number"
                  :value="values[item.name]"
                  class="input-cell"
                  step="any"
                  @input="onInput(item.name, $event)"
                />
                <span v-else class="formula-value" :class="{ negative: (values[item.name] || 0) < 0 }">
                  {{ formatValue(values[item.name], item.mu) }}
                </span>
              </td>
              <td class="col-mu">{{ item.mu }}</td>
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
  actorName: { type: String, default: '' },
  actorColor: { type: String, default: '#2E86C1' },
  defaults: { type: Object, default: null }
})

const emit = defineEmits(['values-changed'])

const activeSheet = ref(0)
const collapsedPanels = reactive({})
const values = reactive({})

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

function onInput(name, event) {
  const val = parseFloat(event.target.value)
  values[name] = isNaN(val) ? 0 : val
  recalcAll()
  emit('values-changed', { ...values })
}

function recalcAll() {
  // Iterate formula items in order and evaluate
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

    // Handle NPV(rate, cashflow) as a simple approximation
    expr = expr.replace(/NPV\(([^,]+),([^)]+)\)/gi, (_, rate, cf) => {
      return `(${cf} / (1 + ${rate}))`
    })

    // Evaluate safely
    const fn = new Function(`"use strict"; return (${expr})`)
    const result = fn()
    return typeof result === 'number' && isFinite(result) ? result : 0
  } catch {
    return 0
  }
}

function formatValue(val, mu) {
  if (val === undefined || val === null || isNaN(val)) return '—'
  if (mu === 'доля' || mu === '%') return (val * 100).toFixed(1) + '%'
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
.template-renderer {
  font-family: var(--font-family, 'Inter', sans-serif);
  color: var(--text-color, #333);
}

.sheet-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--surface-border, #dee2e6);
  overflow-x: auto;
}

.sheet-tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-color-secondary, #6c757d);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  transition: all 0.2s;
}

.sheet-tab:hover {
  color: var(--text-color, #333);
  background: var(--surface-hover, #f8f9fa);
}

.sheet-tab.active {
  color: var(--primary-color, #2E86C1);
  border-bottom-color: var(--primary-color, #2E86C1);
  font-weight: 600;
}

.panel {
  margin-bottom: 0.75rem;
  border: 1px solid var(--surface-border, #dee2e6);
  border-radius: 6px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--surface-ground, #f8f9fa);
  color: var(--text-color, #333);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  user-select: none;
}

.panel-header:hover {
  background: var(--surface-hover, #e9ecef);
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.items-table th {
  padding: 0.4rem 0.6rem;
  text-align: left;
  font-weight: 600;
  background: var(--surface-ground, #f1f3f5);
  border-bottom: 1px solid var(--surface-border, #dee2e6);
  color: var(--text-color-secondary, #6c757d);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.items-table td {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--surface-border, #f1f3f5);
  background: var(--surface-card, transparent);
  color: var(--text-color, #333);
}

.col-name { width: 55%; }
.col-value { width: 30%; text-align: right; }
.col-mu { width: 15%; text-align: right; color: var(--text-color-secondary, #999); font-size: 0.75rem; }

.items-table th.col-value { text-align: right; }
.items-table th.col-mu { text-align: right; }

.row-level0 td {
  font-weight: 700;
  background: var(--surface-ground, #fafafa);
  color: var(--text-color, #333);
}

.row-formula td {
  color: var(--text-color, #333);
}

.input-cell {
  width: 100%;
  max-width: 120px;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--surface-border, #ced4da);
  border-radius: 4px;
  text-align: right;
  font-size: 0.82rem;
  background: var(--surface-overlay, var(--surface-0, #fff));
  color: var(--text-color, #333);
  float: right;
}

.input-cell:focus {
  outline: none;
  border-color: var(--primary-color, #2E86C1);
  box-shadow: 0 0 0 2px rgba(46, 134, 193, 0.15);
}

.formula-value {
  display: block;
  text-align: right;
}

.formula-value.negative {
  color: var(--red-500, #e74c3c);
}
</style>

<template>
  <div class="transform-comparison">
    <div class="comparison-grid">
      <!-- Before -->
      <div class="comparison-panel before">
        <div class="panel-header">
          <h3>До трансформации</h3>
        </div>
        <div class="panel-content">
          <table class="comparison-table">
            <thead>
              <tr>
                <th v-for="(value, key) in beforeData[0]" :key="key">{{ key }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in beforeData" :key="idx">
                <td v-for="(value, key) in row" :key="key">
                  {{ value }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Arrow -->
      <div class="arrow-container">
        <div class="arrow">→</div>
        <div v-if="showChanges" class="changes-badge">
          {{ changeCount }} изменений
        </div>
      </div>

      <!-- After -->
      <div class="comparison-panel after">
        <div class="panel-header">
          <h3>После трансформации</h3>
        </div>
        <div class="panel-content">
          <table class="comparison-table">
            <thead>
              <tr>
                <th
                  v-for="(value, key) in afterData[0]"
                  :key="key"
                  :class="{ 'changed': isColumnChanged(key) }"
                >
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIdx) in afterData" :key="rowIdx">
                <td
                  v-for="(value, key) in row"
                  :key="key"
                  :class="{ 'changed': isCellChanged(rowIdx, key) }"
                >
                  {{ value }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  beforeData: {
    type: Array,
    required: true
  },
  afterData: {
    type: Array,
    required: true
  },
  showChanges: {
    type: Boolean,
    default: true
  }
})

const changeCount = computed(() => {
  let count = 0

  // Check column name changes
  const beforeKeys = Object.keys(props.beforeData[0])
  const afterKeys = Object.keys(props.afterData[0])
  if (beforeKeys.some((key, idx) => key !== afterKeys[idx])) {
    count += afterKeys.length
  }

  // Check cell value changes
  props.beforeData.forEach((beforeRow, rowIdx) => {
    const afterRow = props.afterData[rowIdx]
    if (!afterRow) return

    Object.keys(beforeRow).forEach((beforeKey, colIdx) => {
      const afterKey = Object.keys(afterRow)[colIdx]
      if (beforeRow[beforeKey] !== afterRow[afterKey]) {
        count++
      }
    })
  })

  return count
})

function isColumnChanged(columnName) {
  if (!props.showChanges) return false

  const beforeKeys = Object.keys(props.beforeData[0])
  const afterKeys = Object.keys(props.afterData[0])
  const colIdx = afterKeys.indexOf(columnName)

  return beforeKeys[colIdx] !== columnName
}

function isCellChanged(rowIdx, columnName) {
  if (!props.showChanges) return false

  const beforeRow = props.beforeData[rowIdx]
  const afterRow = props.afterData[rowIdx]

  if (!beforeRow || !afterRow) return false

  const beforeKeys = Object.keys(beforeRow)
  const afterKeys = Object.keys(afterRow)
  const colIdx = afterKeys.indexOf(columnName)
  const beforeKey = beforeKeys[colIdx]

  return beforeRow[beforeKey] !== afterRow[columnName]
}
</script>

<style scoped>
.transform-comparison {
  width: 100%;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: start;
}

.comparison-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.panel-header {
  background-color: #f9fafb;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.panel-content {
  max-height: 400px;
  overflow: auto;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.comparison-table thead {
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 5;
}

.comparison-table th,
.comparison-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.comparison-table th {
  font-weight: 600;
  color: #374151;
}

.comparison-table th.changed {
  background-color: #dbeafe;
  color: #1e40af;
  position: relative;
}

.comparison-table td.changed {
  background-color: #dbeafe;
  font-weight: 500;
  animation: highlight 0.5s ease-in-out;
}

@keyframes highlight {
  0% {
    background-color: #60a5fa;
  }
  100% {
    background-color: #dbeafe;
  }
}

.arrow-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 60px;
}

.arrow {
  font-size: 32px;
  color: #3b82f6;
  font-weight: bold;
}

.changes-badge {
  background-color: #3b82f6;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .comparison-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .arrow-container {
    padding-top: 0;
  }

  .arrow {
    transform: rotate(90deg);
  }
}
</style>

<template>
  <div class="table-highlighter">
    <div class="table-container">
      <table class="tutorial-table">
        <thead>
          <tr>
            <th v-for="(value, key) in data[0]" :key="key">{{ key }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIdx) in data"
            :key="rowIdx"
            :class="getRowClass(rowIdx)"
          >
            <td
              v-for="(value, key) in row"
              :key="key"
              :class="getCellClass(rowIdx, key)"
            >
              <div class="cell-content">
                {{ value }}
                <span v-if="hasHighlight(rowIdx, key)" class="highlight-icon">
                  {{ getHighlightIcon(rowIdx, key) }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  highlights: {
    type: Array,
    default: () => []
  },
  highlightType: {
    type: String,
    default: 'error' // 'error', 'anomaly', 'warning', 'success'
  }
})

function getRowClass(rowIdx) {
  const hasHighlight = props.highlights.some(h => h.row === rowIdx)
  return hasHighlight ? `row-${props.highlightType}` : ''
}

function getCellClass(rowIdx, column) {
  const highlight = props.highlights.find(
    h => h.row === rowIdx && h.column === column
  )
  return highlight ? `cell-${props.highlightType}` : ''
}

function hasHighlight(rowIdx, column) {
  return props.highlights.some(
    h => h.row === rowIdx && h.column === column
  )
}

function getHighlightIcon(rowIdx, column) {
  const icons = {
    error: '⚠️',
    anomaly: '🔍',
    warning: '⚡',
    success: '✅'
  }
  return icons[props.highlightType] || '•'
}
</script>

<style scoped>
.table-highlighter {
  width: 100%;
  overflow: auto;
}

.table-container {
  max-height: 400px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.tutorial-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.tutorial-table thead {
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tutorial-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.tutorial-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.tutorial-table tr:hover {
  background-color: #f9fafb;
}

.cell-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.highlight-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* Error highlighting */
.row-error {
  background-color: #fef2f2;
}

.cell-error {
  background-color: #fee2e2;
  border-left: 3px solid #ef4444;
  font-weight: 500;
}

/* Anomaly highlighting */
.row-anomaly {
  background-color: #fffbeb;
}

.cell-anomaly {
  background-color: #fed7aa;
  border-left: 3px solid #f59e0b;
  font-weight: 500;
}

/* Warning highlighting */
.row-warning {
  background-color: #fefce8;
}

.cell-warning {
  background-color: #fef08a;
  border-left: 3px solid #eab308;
}

/* Success highlighting */
.row-success {
  background-color: #f0fdf4;
}

.cell-success {
  background-color: #dcfce7;
  border-left: 3px solid #10b981;
}
</style>

<template>
  <div class="error-panel" :class="{ 'has-errors': errors.length > 0 }">
    <div class="panel-header">
      <div class="header-left">
        <i class="pi pi-exclamation-triangle"></i>
        <h3>Панель ошибок</h3>
      </div>
      <div class="header-right">
        <Badge v-if="errors.length > 0" :value="errors.length" severity="danger" />
      </div>
    </div>

    <div class="panel-content">
      <!-- No errors state -->
      <div v-if="errors.length === 0" class="no-errors">
        <i class="pi pi-check-circle"></i>
        <p>Нет ошибок</p>
        <span>Все агенты работают нормально</span>
      </div>

      <!-- Error list -->
      <div v-else class="error-list">
        <div
          v-for="error in sortedErrors"
          :key="error.id"
          class="error-item"
          :class="['error-type-' + error.type.toLowerCase(), { fixed: error.fixed }]"
        >
          <div class="error-header">
            <div class="error-icon">
              <i :class="getErrorIcon(error.type)"></i>
            </div>
            <div class="error-title">
              <h4>{{ error.type }}</h4>
              <span class="error-agent">{{ error.node?.agentName || 'System' }}</span>
            </div>
            <Tag v-if="error.fixed" value="Исправлено" severity="success" />
          </div>

          <div class="error-message">
            {{ error.message }}
          </div>

          <!-- Error details -->
          <div v-if="error.details && Object.keys(error.details).length > 0" class="error-details">
            <details>
              <summary>Подробности</summary>
              <div class="details-content">
                <div v-for="(value, key) in error.details" :key="key" class="detail-row">
                  <span class="detail-key">{{ formatKey(key) }}:</span>
                  <span class="detail-value">{{ formatValue(value) }}</span>
                </div>
              </div>
            </details>
          </div>

          <!-- Error actions -->
          <div v-if="!error.fixed" class="error-actions">
            <Button
              label="Посмотреть в таблице"
              icon="pi pi-table"
              text
              size="small"
              @click="viewInTable(error)"
              v-if="error.details?.row"
            />
            <Button
              label="Посмотреть в логах"
              icon="pi pi-align-left"
              text
              size="small"
              @click="viewInLogs(error)"
            />
            <Button
              label="Игнорировать"
              icon="pi pi-times"
              text
              size="small"
              severity="secondary"
              @click="ignoreError(error)"
            />
            <Button
              label="Исправить"
              icon="pi pi-wrench"
              size="small"
              severity="success"
              @click="fixError(error)"
              v-if="error.fix"
            />
          </div>

          <!-- Fix suggestion -->
          <div v-if="error.fix && !error.fixed" class="fix-suggestion">
            <i class="pi pi-lightbulb"></i>
            <span><strong>Решение:</strong> {{ error.fix }}</span>
          </div>

          <!-- Timestamp -->
          <div class="error-timestamp">
            {{ formatTimestamp(error.timestamp) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Panel footer -->
    <div v-if="errors.length > 0" class="panel-footer">
      <Button
        label="Очистить исправленные"
        icon="pi pi-trash"
        text
        size="small"
        @click="clearFixed"
        :disabled="!hasFixedErrors"
      />
      <Button
        label="Очистить все"
        icon="pi pi-times"
        text
        size="small"
        severity="danger"
        @click="clearAll"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  errors: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'view-in-table',
  'view-in-logs',
  'ignore-error',
  'fix-error',
  'clear-fixed',
  'clear-all'
])

// Sorted errors (unfixed first, then by timestamp)
const sortedErrors = computed(() => {
  return [...props.errors].sort((a, b) => {
    if (a.fixed !== b.fixed) {
      return a.fixed ? 1 : -1
    }
    return b.timestamp - a.timestamp
  })
})

// Check if there are fixed errors
const hasFixedErrors = computed(() => {
  return props.errors.some((error) => error.fixed)
})

// Get icon for error type
const getErrorIcon = (type) => {
  const icons = {
    ValidationError: 'pi pi-exclamation-circle',
    ConfigError: 'pi pi-cog',
    TimeoutError: 'pi pi-clock',
    NetworkError: 'pi pi-wifi',
    DataError: 'pi pi-database',
    Error: 'pi pi-times-circle'
  }
  return icons[type] || icons.Error
}

// Format key for display
const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

// Format value for display
const formatValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Format timestamp
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

// View error in table
const viewInTable = (error) => {
  emit('view-in-table', error)
}

// View error in logs
const viewInLogs = (error) => {
  emit('view-in-logs', error)
}

// Ignore error
const ignoreError = (error) => {
  emit('ignore-error', error)
}

// Fix error
const fixError = (error) => {
  emit('fix-error', error)
}

// Clear fixed errors
const clearFixed = () => {
  emit('clear-fixed')
}

// Clear all errors
const clearAll = () => {
  emit('clear-all')
}
</script>

<style scoped>
.error-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.error-panel.has-errors {
  border-left: 4px solid #ef4444;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-left i {
  font-size: 1.25rem;
  color: #ef4444;
}

.header-left h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #991b1b;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: #f9fafb;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.no-errors {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
  color: #10b981;
}

.no-errors i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-errors p {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #047857;
}

.no-errors span {
  font-size: 0.875rem;
  color: #6b7280;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-item {
  background: white;
  border: 1px solid #fecaca;
  border-left: 4px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.3s ease;
}

.error-item:hover {
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.error-item.fixed {
  opacity: 0.6;
  border-left-color: #10b981;
  background: #f0fdf4;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.error-icon {
  width: 40px;
  height: 40px;
  background: #fef2f2;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.error-title {
  flex: 1;
}

.error-title h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #991b1b;
}

.error-agent {
  font-size: 0.8125rem;
  color: #6b7280;
  font-family: 'Consolas', 'Monaco', monospace;
}

.error-message {
  padding: 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #991b1b;
  margin-bottom: 0.75rem;
}

.error-details {
  margin-bottom: 0.75rem;
}

.error-details summary {
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6b7280;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 4px;
  user-select: none;
}

.error-details summary:hover {
  background: #f3f4f6;
}

.details-content {
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.detail-row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.8125rem;
}

.detail-key {
  font-weight: 600;
  color: #374151;
}

.detail-value {
  color: #6b7280;
  font-family: 'Consolas', 'Monaco', monospace;
  word-break: break-all;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.fix-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #78350f;
  margin-bottom: 0.75rem;
}

.fix-suggestion i {
  color: #f59e0b;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

.error-timestamp {
  font-size: 0.75rem;
  color: #9ca3af;
  font-family: 'Consolas', 'Monaco', monospace;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .detail-row {
    grid-template-columns: 1fr;
  }

  .error-actions {
    flex-direction: column;
  }

  .panel-footer {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>

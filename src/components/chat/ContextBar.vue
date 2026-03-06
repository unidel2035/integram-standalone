<template>
  <div class="context-bar" v-if="hasContext || documentContext">
    <!-- Main document chip (the one being edited) -->
    <div v-if="documentContext" class="context-chip document-chip" v-tooltip.bottom="'Основной документ — ИИ редактирует'">
      <i class="pi pi-file-edit chip-icon"></i>
      <span class="context-label">{{ truncate(documentContext.title, 22) }}</span>
      <span class="context-meta">{{ formatSize(documentContext.fullLength) }}</span>
      <button class="chip-remove" @click="$emit('clear-document')" title="Убрать из контекста">×</button>
    </div>

    <!-- Additional reference documents (read-only) -->
    <div
      v-for="doc in additionalDocuments"
      :key="doc.id"
      class="context-chip ref-chip"
      v-tooltip.bottom="'Справочный документ — ИИ только читает'"
    >
      <i class="pi pi-paperclip chip-icon"></i>
      <span class="chip-badge ref-badge">Контекст</span>
      <span class="context-label">{{ truncate(doc.title, 22) }}</span>
      <button class="chip-remove" @click="$emit('remove-additional', doc.id)" title="Убрать">×</button>
    </div>

    <!-- Table context chip -->
    <div v-if="tableContext" class="context-chip table-chip" v-tooltip.bottom="'Таблица Integram в контексте'">
      <i class="pi pi-table chip-icon"></i>
      <span class="context-label">{{ truncate(tableContext.tableName, 22) }}</span>
      <span class="context-meta">{{ tableContext.database }}</span>
      <button class="chip-remove" @click="$emit('clear-table')" title="Убрать">×</button>
    </div>

    <!-- Add document button -->
    <button
      v-if="documentContext"
      class="add-doc-btn"
      @click="$emit('add-document')"
      v-tooltip.bottom="'Добавить документ в контекст (только для чтения)'"
    >
      <i class="pi pi-plus"></i>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  documentContext: {
    type: Object,
    default: null
  },
  tableContext: {
    type: Object,
    default: null
  },
  additionalDocuments: {
    type: Array,
    default: () => []
  }
})

defineEmits(['clear-document', 'clear-table', 'remove-additional', 'add-document'])

const hasContext = computed(() => {
  return props.tableContext || props.additionalDocuments.length > 0
})

const truncate = (str, maxLen) => {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + '…'
}

const formatSize = (chars) => {
  if (!chars) return ''
  if (chars < 1000) return `${chars}с`
  return `${(chars / 1000).toFixed(1)}K`
}
</script>

<style scoped>
.context-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid rgba(99, 102, 241, 0.15);
  flex-wrap: wrap;
}

.context-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.775rem;
  border-radius: 14px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  max-width: 220px;
}

.chip-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
}

.chip-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.05rem 0.3rem;
  border-radius: 8px;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.main-badge {
  background: rgba(59, 130, 246, 0.2);
  color: var(--p-blue-600, #2563eb);
}

.ref-badge {
  background: rgba(245, 158, 11, 0.2);
  color: var(--p-amber-600, #d97706);
}

.document-chip {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%);
  color: var(--p-blue-700, #1d4ed8);
  border-color: rgba(59, 130, 246, 0.25);
}

:root.dark .document-chip, .p-dark .document-chip {
  color: var(--p-blue-300, #93c5fd);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(37, 99, 235, 0.22) 100%);
}

:root.dark .main-badge, .p-dark .main-badge {
  color: var(--p-blue-300, #93c5fd);
}

.ref-chip {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%);
  color: var(--p-amber-700, #b45309);
  border-color: rgba(245, 158, 11, 0.25);
}

:root.dark .ref-chip, .p-dark .ref-chip {
  color: var(--p-amber-300, #fcd34d);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.22) 100%);
}

:root.dark .ref-badge, .p-dark .ref-badge {
  color: var(--p-amber-300, #fcd34d);
}

.table-chip {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.15) 100%);
  color: var(--p-green-700, #15803d);
  border-color: rgba(34, 197, 94, 0.25);
}

:root.dark .table-chip, .p-dark .table-chip {
  color: var(--p-green-300, #86efac);
}

.context-label {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.context-meta {
  font-size: 0.7rem;
  opacity: 0.65;
  flex-shrink: 0;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0 0.1rem;
  opacity: 0.45;
  color: inherit;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.chip-remove:hover {
  opacity: 1;
}

.add-doc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 1px dashed rgba(99, 102, 241, 0.4);
  background: transparent;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
}

.context-bar:hover .add-doc-btn {
  opacity: 1;
  pointer-events: auto;
}

.add-doc-btn:hover {
  border-color: var(--p-primary-color, var(--primary-color));
  color: var(--p-primary-color, var(--primary-color));
  background: rgba(99, 102, 241, 0.06);
}

.add-doc-btn .pi {
  font-size: 0.65rem;
}
</style>

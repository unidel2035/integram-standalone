<template>
  <div
    class="kanban-column"
    :class="{ 'drag-over': isDragOver, collapsed: isCollapsed }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- Column header -->
    <div class="column-header" @click="toggleCollapse">
      <div class="column-header-left">
        <span class="column-collapse-icon">
          <i :class="isCollapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-down'"></i>
        </span>
        <span class="column-title">{{ groupLabel || groupValue || '(Пусто)' }}</span>
        <span class="column-count">{{ cards.length }}</span>
      </div>
    </div>

    <!-- Cards -->
    <div v-if="!isCollapsed" class="column-cards">
      <CardItem
        v-for="card in cards"
        :key="card.id"
        :card="card"
        :size="cardSize"
        :visible-field-ids="visibleFieldIds"
        :stripe-color="color"
        :show-image="showImage"
        :image-field="imageField"
        @click="$emit('card-click', card)"
        @edit="$emit('card-edit', card)"
        @drag-start="onCardDragStart"
        @drop="onCardDrop"
        @inline-save="$emit('card-inline-save', { card, ...$event })"
      />

      <!-- Empty placeholder when dragging over empty column -->
      <div
        v-if="!cards.length"
        class="empty-column-placeholder"
        :class="{ active: isDragOver }"
      >
        <i class="pi pi-plus-circle"></i>
        <span>Перетащите сюда</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CardItem from './CardItem.vue'

const props = defineProps({
  groupValue: { type: String, default: '' },
  groupLabel: { type: String, default: null },
  cards: { type: Array, default: () => [] },
  cardSize: { type: String, default: 'M' },
  visibleFieldIds: { type: Array, default: () => [] },
  color: { type: String, default: '#6366f1' },
  showImage: { type: Boolean, default: true },
  imageField: { type: String, default: null }
})

const emit = defineEmits(['card-click', 'card-edit', 'card-dropped', 'card-reordered', 'card-inline-save'])

const isDragOver = ref(false)
const isCollapsed = ref(false)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function onCardDragStart(card) {
  // Forward drag-start event up to parent if needed
}

function onCardDrop({ draggedCardId, targetCardId }) {
  // Check if the dragged card belongs to this column (same-column reorder)
  const isInThisColumn = props.cards.some(c => String(c.id) === String(draggedCardId))
  if (isInThisColumn) {
    // Reorder within same column
    emit('card-reordered', { draggedCardId, targetCardId, groupValue: props.groupValue })
  } else {
    // Cross-column drop: update the group field via card-dropped
    emit('card-dropped', { cardId: draggedCardId, targetGroupValue: props.groupValue })
  }
}

function onDragOver(e) {
  e.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

function onDragLeave(e) {
  // Only clear if leaving the column itself, not a child
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isDragOver.value = false
  }
}

function onDrop(e) {
  isDragOver.value = false
  const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}')
  if (data.cardId) {
    emit('card-dropped', { cardId: data.cardId, targetGroupValue: props.groupValue })
  }
}
</script>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  min-width: 240px;
  width: 240px;
  border-radius: 8px;
  background: var(--p-content-background, #f8fafc);
  border: 2px dashed transparent;
  transition: border-color 0.15s, background 0.15s;
}

.kanban-column.drag-over {
  border-color: var(--p-primary-color, #6366f1);
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 10%, transparent);
}

.column-header {
  padding: 10px 12px 8px;
  cursor: pointer;
  user-select: none;
}

.column-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.column-collapse-icon {
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 11px;
  width: 14px;
}

.column-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-count {
  background: var(--p-content-border-color, #e2e8f0);
  color: var(--p-text-muted-color, #64748b);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
}

.column-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 10px 12px;
  flex: 1;
  min-height: 60px;
}

.empty-column-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 12px;
  border: 2px dashed var(--p-content-border-color, #e2e8f0);
  border-radius: 8px;
  color: var(--p-text-muted-color, #cbd5e1);
  font-size: 12px;
  transition: all 0.15s;
}

.empty-column-placeholder.active {
  border-color: var(--p-primary-color, #6366f1);
  color: var(--p-primary-color, #6366f1);
  background: color-mix(in srgb, var(--p-primary-color, #6366f1) 10%, transparent);
}

.kanban-column.collapsed .column-cards {
  display: none;
}
</style>

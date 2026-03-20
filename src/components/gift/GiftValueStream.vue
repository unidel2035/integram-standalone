<template>
  <div class="gvs-root">
    <div class="fst-section-title">
      <i class="pi pi-list" />
      Поток обменов ценностью
    </div>
    <div class="gvs-list" v-if="exchanges.length">
      <div v-for="ex in exchanges" :key="ex.id" class="gvs-item">
        <div class="gvs-flow">
          <span class="gvs-person gvs-from">{{ ex.from }}</span>
          <i class="pi pi-arrow-right gvs-arrow" />
          <span class="gvs-person gvs-to">{{ ex.to }}</span>
        </div>
        <div class="gvs-content">{{ ex.content }}</div>
        <div class="gvs-meta">
          <Tag :value="ex.layer || 'Общий'" class="gvs-tag-layer" />
          <Tag
            :value="statusLabel(ex.status)"
            :severity="statusSeverity(ex.status)"
            class="gvs-tag-status"
          />
          <span class="gvs-time">{{ ex.time }}</span>
        </div>
      </div>
    </div>
    <div v-else class="gvs-empty">
      <i class="pi pi-inbox" />
      <span>Обменов пока нет</span>
    </div>
  </div>
</template>

<script setup>
import Tag from 'primevue/tag';

defineProps({
  exchanges: { type: Array, default: () => [] }
});

function statusLabel(status) {
  const map = {
    pending: 'Ожидает',
    accepted: 'Принят',
    declined: 'Отклонён',
    returned: 'Возвращён'
  };
  return map[status] || status || 'Неизвестно';
}

function statusSeverity(status) {
  const map = {
    pending: 'warn',
    accepted: 'success',
    declined: 'danger',
    returned: 'info'
  };
  return map[status] || 'secondary';
}
</script>

<style scoped>
.gvs-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gvs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.gvs-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  transition: border-color 0.15s;
}

.gvs-item:hover {
  border-color: var(--fst-purple);
}

.gvs-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.gvs-person {
  color: var(--p-text-color);
}

.gvs-arrow {
  font-size: 11px;
  color: var(--fst-cyan);
}

.gvs-content {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

.gvs-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gvs-tag-layer {
  font-size: 10px;
}

.gvs-tag-status {
  font-size: 10px;
}

.gvs-time {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-left: auto;
}

.gvs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}
</style>

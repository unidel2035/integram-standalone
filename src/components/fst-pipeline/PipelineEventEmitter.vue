<script setup>
import { ref, computed } from 'vue'
import { useEventStore } from '@/stores/eventStore.js'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  dealId:       { type: String, required: true },
  currentStage: { type: Object, default: null },
})

const emit = defineEmits(['eventAdded'])

const eventStore = useEventStore()
const toast = useToast()

const selectedActor = ref('УТ')
const actors = ['УТ', 'ИК', 'РП', 'Инициатор', 'Эксперт', 'Оценщик']

const confirmEvent   = ref(null)
const confirmVisible = ref(false)
const notes          = ref('')

const availableEvents = computed(() => {
  if (!props.currentStage) return []
  return props.currentStage.nextPossible || []
})

function openConfirm(eventDef) {
  confirmEvent.value = eventDef
  notes.value = ''
  confirmVisible.value = true
}

function doEmit() {
  if (!confirmEvent.value) return
  const evt = eventStore.add(
    confirmEvent.value.entityType || 'deal',
    props.dealId,
    confirmEvent.value.type,
    {
      actor: selectedActor.value,
      notes: notes.value,
      stageId: props.currentStage?.id,
      reglamentRef: confirmEvent.value.reglamentRef,
    }
  )
  toast.add({
    severity: 'success',
    summary: 'Событие зафиксировано',
    detail: confirmEvent.value.label,
    life: 4000,
  })
  confirmVisible.value = false
  emit('eventAdded', evt)
}

const statusDot = {
  done:    { color: 'var(--fst-green)',  label: 'Завершён' },
  active:  { color: 'var(--fst-blue)',   label: 'Активен'  },
  pending: { color: 'var(--p-text-muted-color)', label: 'Ожидает' },
  blocked: { color: 'var(--fst-red)',    label: 'Заблокирован' },
}
</script>

<template>
  <div class="pee-panel">
    <!-- Заголовок -->
    <div class="pee-header">
      <i class="pi pi-bolt pee-header-icon"></i>
      <span class="pee-header-title">Зафиксировать событие</span>
      <div v-if="currentStage" class="pee-stage-badge"
        :style="{ color: currentStage.color }">
        {{ currentStage.label }}
      </div>
    </div>

    <!-- Актор -->
    <div class="pee-actor-section">
      <div class="pee-section-label">Актор (кто фиксирует)</div>
      <SelectButton
        v-model="selectedActor"
        :options="actors"
        :allowEmpty="false"
        class="pee-actor-btn"
      />
    </div>

    <!-- Список доступных событий -->
    <div v-if="availableEvents.length" class="pee-events-list">
      <div class="pee-section-label">Доступные события</div>
      <div
        v-for="evt in availableEvents"
        :key="evt.type"
        class="pee-event-card"
        @click="openConfirm(evt)"
      >
        <div class="pee-event-left">
          <i :class="evt.icon || 'pi pi-circle'" class="pee-event-icon"
            :style="{ color: evt.color }"></i>
          <div class="pee-event-info">
            <div class="pee-event-label">{{ evt.label }}</div>
            <div class="pee-event-desc">{{ evt.description }}</div>
          </div>
        </div>
        <div class="pee-event-meta">
          <span class="pee-event-ref">{{ evt.reglamentRef }}</span>
          <i class="pi pi-play pee-event-play"></i>
        </div>
      </div>
    </div>

    <div v-else class="pee-empty">
      <i class="pi pi-check-circle pee-empty-icon"></i>
      <span v-if="currentStage?.status === 'done'">Подпроцесс завершён</span>
      <span v-else-if="!currentStage">Выберите стадию слева</span>
      <span v-else>Нет доступных действий</span>
    </div>

    <!-- Confirm Dialog -->
    <Dialog
      v-model:visible="confirmVisible"
      :header="confirmEvent?.label"
      modal
      :style="{ width: 'min(94vw, 520px)' }"
    >
      <div v-if="confirmEvent" class="pee-confirm">
        <div class="pee-confirm-meta">
          <Tag value="Регламент" severity="secondary" />
          <span class="pee-confirm-ref">{{ confirmEvent.reglamentRef }}</span>
        </div>
        <div class="pee-confirm-desc">{{ confirmEvent.description }}</div>

        <div class="pee-confirm-field">
          <label class="pee-confirm-label">Актор</label>
          <InputText :value="selectedActor" disabled fluid />
        </div>

        <div class="pee-confirm-field">
          <label class="pee-confirm-label">Комментарий / основание</label>
          <Textarea v-model="notes" rows="3" placeholder="Опционально: протокол, дата документа..." fluid />
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" severity="secondary" @click="confirmVisible = false" />
        <Button label="Зафиксировать" icon="pi pi-check" @click="doEmit" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.pee-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  overflow: hidden;
}

.pee-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}

.pee-header-icon {
  font-size: 0.93rem;
  color: var(--p-primary-color);
}

.pee-header-title {
  font-size: 0.83rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.pee-stage-badge {
  font-size: 0.78rem;
  font-weight: 600;
}

.pee-actor-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--p-content-border-color);
}

.pee-section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.pee-actor-btn {
  width: 100%;
  flex-wrap: wrap;
}

.pee-events-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pee-event-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.pee-event-card:hover {
  background: var(--p-surface-card);
  border-color: var(--p-primary-color);
}

.pee-event-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.pee-event-icon {
  font-size: 1rem;
  margin-top: 1px;
  flex-shrink: 0;
}

.pee-event-info {
  min-width: 0;
}

.pee-event-label {
  font-size: 0.88rem;
  font-weight: 500;
}

.pee-event-desc {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.pee-event-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.pee-event-ref {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-style: italic;
  white-space: nowrap;
}

.pee-event-play {
  font-size: 0.75rem;
  color: var(--p-primary-color);
}

.pee-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--p-text-muted-color);
  font-size: 0.88rem;
}

.pee-empty-icon {
  font-size: 1.75rem;
  opacity: 0.4;
}

/* Confirm */
.pee-confirm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.pee-confirm-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pee-confirm-ref {
  font-size: 0.83rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}

.pee-confirm-desc {
  font-size: 0.88rem;
  line-height: 1.5;
  background: var(--p-surface-card);
  border-radius: 12px;
  padding: 10px 12px;
  color: var(--p-text-muted-color);
}

.pee-confirm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pee-confirm-label {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
}
</style>

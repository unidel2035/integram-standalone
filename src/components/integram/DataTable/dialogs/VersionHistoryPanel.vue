<template>
  <!-- Slide-in side panel showing version history for a row -->
  <Dialog
    v-model:visible="visible"
    :header="`История версий — ID ${objId}`"
    :style="{ width: '680px', maxWidth: '95vw' }"
    :modal="false"
    :draggable="true"
    :resizable="true"
    position="right"
    class="version-history-panel"
    @hide="onHide"
  >
    <!-- Toolbar -->
    <div class="flex align-items-center gap-2 mb-3">
      <Button
        icon="pi pi-refresh"
        size="small"
        severity="secondary"
        text
        :loading="loading"
        title="Обновить историю"
        @click="loadHistory"
      />
      <span class="text-sm text-color-secondary">
        {{ history.length }} версий{{ currentBranch ? ` • ветка: ${currentBranch}` : '' }}
      </span>
      <div class="ml-auto">
        <Button
          v-if="selectedVersion && selectedVersion.id !== String(objId)"
          icon="pi pi-history"
          label="Восстановить"
          size="small"
          severity="warning"
          :loading="rollingBack"
          @click="confirmRollback"
        />
      </div>
    </div>

    <!-- Error state -->
    <Message v-if="errorMsg" severity="error" :closable="true" class="mb-3" @close="errorMsg = ''">
      {{ errorMsg }}
    </Message>

    <!-- Loading skeleton -->
    <div v-if="loading && history.length === 0" class="flex flex-column gap-2">
      <Skeleton v-for="i in 4" :key="i" height="3.5rem" border-radius="8px" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && history.length === 0" class="flex flex-column align-items-center gap-3 py-6 text-color-secondary">
      <i class="pi pi-clock" style="font-size: 2rem" />
      <span>История версий пуста</span>
      <span class="text-sm">Объект ещё не версионировался</span>
    </div>

    <!-- Version timeline -->
    <div v-else class="version-timeline">
      <div
        v-for="(entry, idx) in historyDesc"
        :key="entry.id"
        class="version-entry"
        :class="{
          'version-entry--selected': selectedVersion?.id === entry.id,
          'version-entry--latest': entry.isLatest,
          'version-entry--current': entry.id === String(objId),
        }"
        @click="selectVersion(entry)"
      >
        <!-- Left: version badge + timeline line -->
        <div class="version-entry__track">
          <div class="version-entry__badge">
            <span class="version-entry__badge-text">v{{ entry.version }}</span>
          </div>
          <div v-if="idx < historyDesc.length - 1" class="version-entry__line" />
        </div>

        <!-- Right: commit info -->
        <div class="version-entry__content">
          <div class="flex align-items-center gap-2 flex-wrap">
            <Tag
              v-if="entry.isLatest"
              value="latest"
              severity="success"
              class="text-xs"
            />
            <Tag
              v-if="entry.id === String(objId)"
              value="текущий"
              severity="info"
              class="text-xs"
            />
            <Tag
              :value="entry.branch || 'main'"
              severity="secondary"
              class="text-xs"
            />
          </div>

          <div class="version-entry__message mt-1">
            {{ entry.commitMsg || '—' }}
          </div>

          <div class="version-entry__meta text-xs text-color-secondary mt-1">
            <span v-if="entry.committedAt">{{ formatDate(entry.committedAt) }}</span>
            <span v-if="entry.committedBy"> · ID {{ entry.committedBy }}</span>
            <span> · obj #{{ entry.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Diff panel (shown when a non-current version is selected) -->
    <template v-if="selectedVersion && selectedVersion.id !== String(objId)">
      <Divider />
      <div class="diff-panel">
        <div class="flex align-items-center gap-2 mb-2">
          <span class="font-semibold text-sm">Изменения относительно выбранной версии</span>
          <Button
            icon="pi pi-refresh"
            size="small"
            text
            severity="secondary"
            :loading="loadingDiff"
            @click="loadDiff"
          />
        </div>

        <div v-if="loadingDiff" class="flex flex-column gap-1">
          <Skeleton v-for="i in 3" :key="i" height="2rem" />
        </div>

        <div v-else-if="diffResult">
          <div v-if="diffResult.changed.length === 0" class="text-sm text-color-secondary py-2">
            Изменений нет
          </div>
          <div v-else class="flex flex-column gap-1">
            <div
              v-for="change in diffResult.changed"
              :key="change.reqId"
              class="diff-row"
            >
              <span class="diff-row__field font-medium">{{ change.field }}</span>
              <div class="diff-row__values">
                <span class="diff-row__from">{{ change.from ?? '∅' }}</span>
                <i class="pi pi-arrow-right text-xs mx-1 text-color-secondary" />
                <span class="diff-row__to">{{ change.to ?? '∅' }}</span>
              </div>
            </div>
          </div>

          <div class="text-xs text-color-secondary mt-2">
            Изменено полей: {{ diffResult.changed.length }} · Без изменений: {{ diffResult.unchanged.length }}
          </div>
        </div>
      </div>
    </template>

    <!-- Footer actions -->
    <template #footer>
      <div class="flex justify-content-end gap-2">
        <Button label="Закрыть" severity="secondary" text @click="visible = false" />
        <Button
          v-if="selectedVersion && selectedVersion.id !== String(objId)"
          icon="pi pi-history"
          :label="`Восстановить v${selectedVersion.version}`"
          severity="warning"
          :loading="rollingBack"
          @click="confirmRollback"
        />
      </div>
    </template>
  </Dialog>

  <!-- Rollback confirmation -->
  <ConfirmDialog group="version-history-rollback" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { getHistory, getDiff, rollbackObject } from '@/services/datasetVersioningService'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps({
  /** Whether the panel is visible */
  modelValue: {
    type: Boolean,
    default: false,
  },
  /** Integram server URL */
  serverUrl: {
    type: String,
    required: true,
  },
  /** Integram database name */
  database: {
    type: String,
    required: true,
  },
  /** X-Authorization token */
  token: {
    type: String,
    required: true,
  },
  /** XSRF token for POST requests */
  xsrfToken: {
    type: String,
    default: '',
  },
  /** Object ID whose history to display */
  objId: {
    type: [String, Number],
    required: true,
  },
  /** Current user ID (for rollback commits) */
  userId: {
    type: [String, Number],
    default: null,
  },
})

const emit = defineEmits([
  'update:modelValue',
  /** Emitted after a successful rollback with the new object ID */
  'rollback-complete',
])

// ── State ─────────────────────────────────────────────────────────────────────

const confirm = useConfirm()
const toast = useToast()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const history = ref([])
const loading = ref(false)
const errorMsg = ref('')

const selectedVersion = ref(null)
const diffResult = ref(null)
const loadingDiff = ref(false)

const rollingBack = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────

/** History shown newest → oldest (reverse of API response) */
const historyDesc = computed(() => [...history.value].reverse())

const currentBranch = computed(() => {
  const latest = history.value.find((e) => e.isLatest)
  return latest?.branch ?? null
})

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      history.value = []
      selectedVersion.value = null
      diffResult.value = null
      errorMsg.value = ''
      loadHistory()
    }
  },
)

watch(selectedVersion, (ver) => {
  diffResult.value = null
  if (ver && ver.id !== String(props.objId)) {
    loadDiff()
  }
})

// ── Methods ───────────────────────────────────────────────────────────────────

async function loadHistory() {
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await getHistory({
      serverUrl: props.serverUrl,
      database: props.database,
      token: props.token,
      objId: props.objId,
    })
    history.value = result.history ?? []
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadDiff() {
  if (!selectedVersion.value) return
  loadingDiff.value = true
  try {
    const result = await getDiff({
      serverUrl: props.serverUrl,
      database: props.database,
      token: props.token,
      objId: props.objId,
      v1: selectedVersion.value.id,
      v2: props.objId,
    })
    diffResult.value = result
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка diff', detail: err.message, life: 4000 })
  } finally {
    loadingDiff.value = false
  }
}

function selectVersion(entry) {
  if (selectedVersion.value?.id === entry.id) {
    selectedVersion.value = null
    diffResult.value = null
    return
  }
  selectedVersion.value = entry
}

function confirmRollback() {
  if (!selectedVersion.value) return
  confirm.require({
    group: 'version-history-rollback',
    message: `Восстановить версию v${selectedVersion.value.version} (obj #${selectedVersion.value.id})? Текущая версия сохранится в истории.`,
    header: 'Подтвердите откат',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Восстановить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-warning',
    accept: () => doRollback(),
  })
}

async function doRollback() {
  if (!selectedVersion.value) return
  rollingBack.value = true
  try {
    const result = await rollbackObject({
      serverUrl: props.serverUrl,
      database: props.database,
      token: props.token,
      xsrfToken: props.xsrfToken,
      objId: props.objId,
      targetVersionObjId: selectedVersion.value.id,
      userId: props.userId,
      branch: selectedVersion.value.branch ?? 'main',
    })

    toast.add({
      severity: 'success',
      summary: 'Откат выполнен',
      detail: `Создана новая версия v${result.version} (obj #${result.newObjId})`,
      life: 5000,
    })

    emit('rollback-complete', result)
    visible.value = false
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка отката', detail: err.message, life: 5000 })
  } finally {
    rollingBack.value = false
  }
}

function onHide() {
  emit('update:modelValue', false)
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoStr))
  } catch {
    return isoStr
  }
}
</script>

<style scoped>
.version-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.version-entry {
  display: flex;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.version-entry:hover {
  background: var(--surface-hover);
}

.version-entry--selected {
  background: var(--primary-50, #eff6ff);
  border: 1px solid var(--primary-200, #bfdbfe);
}

.version-entry--latest .version-entry__badge {
  background: var(--green-500);
}

.version-entry--current .version-entry__badge {
  background: var(--primary-500);
}

.version-entry__track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 36px;
}

.version-entry__badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface-400);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.version-entry__badge-text {
  font-size: 0.65rem;
  font-weight: 700;
  color: white;
}

.version-entry__line {
  width: 2px;
  flex: 1;
  min-height: 12px;
  background: var(--surface-300);
  margin-top: 4px;
}

.version-entry__content {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}

.version-entry__message {
  font-size: 0.875rem;
  word-break: break-word;
}

.version-entry__meta {
  line-height: 1.4;
}

/* Diff panel */
.diff-panel {
  padding: 4px 0;
}

.diff-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8125rem;
}

.diff-row:hover {
  background: var(--surface-hover);
}

.diff-row__field {
  min-width: 120px;
  color: var(--text-color);
}

.diff-row__values {
  display: flex;
  align-items: center;
  gap: 2px;
  font-family: monospace;
  font-size: 0.8rem;
}

.diff-row__from {
  color: var(--red-500);
  text-decoration: line-through;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-row__to {
  color: var(--green-600);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

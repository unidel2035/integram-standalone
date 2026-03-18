<template>
  <div class="query-builder">
    <div class="panel-toolbar">
      <h3>Query Builder (BSL)</h3>
    </div>

    <div class="query-layout">
      <div class="query-input-area">
        <div class="query-helpers">
          <span class="helper-label">Вставить:</span>
          <Button label="$EQ" size="small" text @click="insertSnippet('$EQ.')" />
          <Button label="$NE" size="small" text @click="insertSnippet('$NE.')" />
          <Button label="$GT" size="small" text @click="insertSnippet('$GT.')" />
          <Button label="$LT" size="small" text @click="insertSnippet('$LT.')" />
          <Button label="$Model()" size="small" text @click="insertModelSnippet" />
          <Button label="$Concept()" size="small" text @click="insertConceptSnippet" />
          <Button label="$()" size="small" text @click="insertSnippet('$()')" />
        </div>

        <Textarea ref="queryInput" v-model="query" rows="4" class="w-full query-textarea"
          placeholder='Пример: $($EQ.$Model("Model_Person")).name' />

        <div class="query-examples">
          <span class="helper-label">Примеры:</span>
          <Button v-for="ex in examples" :key="ex.label" :label="ex.label" size="small" text
            @click="query = ex.query" v-tooltip="ex.query" />
        </div>

        <div class="query-actions">
          <Button label="Выполнить" icon="pi pi-play" @click="execute" :loading="executing" />
          <Button label="Очистить" icon="pi pi-times" severity="secondary" text @click="clearResults" />
        </div>
      </div>

      <div class="query-results" v-if="results || error">
        <h4>Результат</h4>

        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

        <div v-if="results && Array.isArray(results.results)">
          <DataTable :value="results.results" size="small" stripedRows :rows="20" paginator>
            <Column v-for="col in resultColumns" :key="col" :field="col" :header="col" />
          </DataTable>
        </div>

        <div v-else-if="results" class="json-result">
          <pre>{{ JSON.stringify(results, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import axios from 'axios'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'

const API = inject('eventEngineAPI')

const query = ref('')
const queryInput = ref(null)
const results = ref(null)
const error = ref(null)
const executing = ref(false)

const examples = [
  { label: 'Все индивиды модели', query: '$($EQ.$Model("Model_Person"))' },
  { label: 'Свойство name', query: '$($EQ.$Model("Model_Person")).name' },
  { label: 'По концепту', query: '$($EQ.$Concept("Person"))' },
]

const resultColumns = computed(() => {
  if (!results.value?.results?.length) return []
  return Object.keys(results.value.results[0])
})

function insertSnippet(snippet) {
  const el = queryInput.value?.$el?.querySelector('textarea')
  if (!el) { query.value += snippet; return }
  const start = el.selectionStart
  const end = el.selectionEnd
  query.value = query.value.substring(0, start) + snippet + query.value.substring(end)
}

function insertModelSnippet() { insertSnippet('$Model("")') }
function insertConceptSnippet() { insertSnippet('$Concept("")') }

async function execute() {
  if (!query.value.trim()) return
  executing.value = true
  error.value = null
  results.value = null
  try {
    const { data } = await axios.post(`${API}/query`, { query: query.value })
    if (data.success) {
      results.value = data.data
    } else {
      error.value = data.error || 'Query failed'
    }
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  }
  executing.value = false
}

function clearResults() {
  results.value = null
  error.value = null
}
</script>

<style scoped>
.query-builder { max-width: 1000px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3 { margin: 0; }

.query-layout { display: flex; flex-direction: column; gap: 16px; }

.query-helpers { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.helper-label { font-size: 0.85rem; color: var(--p-text-muted-color); font-weight: 500; }

.query-textarea { font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9rem; }

.query-examples { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 4px; }

.query-actions { display: flex; gap: 8px; margin-top: 8px; }

.query-results { padding: 16px; background: var(--p-surface-card); border-radius: 8px; border: 1px solid var(--p-surface-border); }
.query-results h4 { margin: 0 0 12px 0; }

.json-result { max-height: 400px; overflow: auto; }
.json-result pre { font-size: 0.85rem; white-space: pre-wrap; word-break: break-all; margin: 0; }
</style>
